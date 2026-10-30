   # 🏛️ PaperTrail — Complete System Architecture & Engineering Blueprint

   > **A Deep-Dive Architectural Guide for Developers, Architects, and Evaluators**  
   > *Explaining the Layers, Data Pipelines, Decision Rationales, and Engineering Patterns behind PaperTrail.*

   ---

   ## 📑 Table of Contents
   1. [Architectural Overview & High-Level Topology](#1-architectural-overview--high-level-topology)
   2. [Component Layer Breakdown](#2-component-layer-breakdown)
      - [2.1 Presentation Layer (Client Browser)](#21-presentation-layer-client-browser)
      - [2.2 API & Routing Layer (FastAPI Gateway)](#22-api--routing-layer-fastapi-gateway)
      - [2.3 Services & Processing Layer](#23-services--processing-layer)
      - [2.4 Persistence & Storage Layer](#24-persistence--storage-layer)
      - [2.5 External Cloud Infrastructure](#25-external-cloud-infrastructure)
   3. [Key End-to-End Workflows & Sequence Diagrams](#3-key-end-to-end-workflows--sequence-diagrams)
      - [3.1 The Ingestion, Hashing & Storage Pipeline](#31-the-ingestion-hashing--storage-pipeline)
      - [3.2 The Two-Tier Hybrid AI Document Verification Engine](#32-the-two-tier-hybrid-ai-document-verification-engine)
      - [3.3 Real-Time Debounced Search & Discovery Flow](#33-real-time-debounced-search--discovery-flow)
      - [3.4 Atomic Download Tracking Flow](#34-atomic-download-tracking-flow)
      - [3.5 Abuse Prevention, Device Fingerprinting & Auto-Removal Flow](#35-abuse-prevention-device-fingerprinting--auto-removal-flow)
   4. [Database Architecture & Entity-Relationship Model](#4-database-architecture--entity-relationship-model)
   5. [Key Design Patterns & Software Engineering Principles](#5-key-design-patterns--software-engineering-principles)
   6. [Non-Functional Requirements & Security Guarantees](#6-non-functional-requirements--security-guarantees)

   ---

   ## 1. Architectural Overview & High-Level Topology

   PaperTrail is structured as a **modular, single-origin, layered service application**. It combines a lightweight, zero-dependency browser client with an asynchronous Python backend, supported by managed cloud storage and multimodal artificial intelligence.

   ```text
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                             CLIENT LAYER (BROWSER)                          │
   │  - Semantic HTML5 + Tailwind CSS (Responsive, Dark/Light Mode)              │
   │  - Vanilla ES6+ JavaScript (State, Debounced Events, Multipart FormData)    │
   │  - Device Fingerprint Storage (localStorage UUID Generator)                 │
   │  - In-Browser PDF Viewing Modal (Iframe Sandbox)                            │
   └──────────────────────────────────────┬──────────────────────────────────────┘
                                          │ HTTP / JSON / Multipart
                                          ▼
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                           API GATEWAY / APPLICATION                         │
   │  - FastAPI Web Engine + ASGI Production Server (Uvicorn)                    │
   │  - Application Lifespan Context Manager (DB Pool Prep, Folders)             │
   │  - Cross-Origin Resource Sharing (CORS Middleware)                          │
   │  - Static Mounts (/uploads for local buffer, / for single-origin UI)        │
   ├──────────────────────────────────────┬──────────────────────────────────────┤
   │               ROUTERS                │               SERVICES               │
   │  ┌────────────────────────────────┐  │  ┌────────────────────────────────┐  │
   │  │ routers/papers.py              │  │  │ services/storage.py            │  │
   │  │  - POST   /api/papers          │  │  │  - 1 MiB Chunked Streaming     │  │
   │  │  - GET    /api/papers          │  │  │  - SHA-256 Digest Engine       │  │
   │  │  - GET    /api/papers/{id}/dl  │  │  │  - %PDF- Magic Byte Check      │  │
   │  │  - POST   /api/papers/{id}/rpt │  │  │  - Supabase Storage Client     │  │
   │  │  - POST   /api/papers/{id}/vot │  │  └────────────────────────────────┘  │
   │  └────────────────────────────────┘  │  ┌────────────────────────────────┐  │
   │  ┌────────────────────────────────┐  │  │ services/ai_scanner.py         │  │
   │  │ routers/resources.py           │  │  │  - Tier 1: PyMuPDF + Regex     │  │
   │  │  - POST   /api/courses/{c}/res │  │  │  - Tier 2: Gemini 3.8 Flash    │  │
   │  │  - GET    /api/courses/{c}/res │  │  └────────────────────────────────┘  │
   │  └────────────────────────────────┘  │                                      │
   ├──────────────────────────────────────┴──────────────────────────────────────┤
   │                         DATA ACCESS & PERSISTENCE LAYER                     │
   │  - SQLAlchemy 2.0 Declarative ORM (Psycopg 3 Driver)                        │
   │  - Connection Pool with Pre-Ping Health Checks (pool_pre_ping=True)         │
   │  - Pydantic Settings Configuration (Immutable Cached Singleton)             │
   └──────────────────────┬──────────────────────────────────────┬───────────────┘
                        │ SQL Connections                      │ Object API / HTTPS
                        ▼                                      ▼
         ┌───────────────────────────────┐      ┌───────────────────────────────┐
         │     POSTGRESQL (SUPABASE)     │      │   SUPABASE OBJECT STORAGE     │
         │  - Table: papers              │      │  - Bucket: "past_papers"      │
         │  - Table: paper_reports       │      │  - Public CDN Delivery        │
         │  - Table: course_resources    │      │  - Immutable UUID/Hash URLs   │
         └───────────────────────────────┘      └───────────────────────────────┘
                                                               ▲
                                                               │ REST Multimodal Ingestion
                                                ┌───────────────┴───────────────┐
                                                │    GOOGLE GEMINI 3.8 FLASH    │
                                                │  - Multimodal Vision OCR      │
                                                │  - Structured JSON Evaluation │
                                                └───────────────────────────────┘
   ```

   ---

   ## 2. Component Layer Breakdown

   ### 2.1 Presentation Layer (Client Browser)
   * **Technology Stack:** Semantic HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (Play CDN), Google Fonts (Inter & Manrope).
   * **Architectural Strategy:** 
   * **Zero-Build Architecture:** No complex build systems (Webpack, Vite, npm). The frontend runs directly in any modern browser, simplifying deployment and local development.
   * **Single-Origin Deployment:** When hosted, FastAPI serves `frontend/index.html` and `frontend/app.js` directly from the root mount (`/`), eliminating cross-origin issues between frontend and backend in production.
   * **XSS Defense:** DOM generation avoids `innerHTML` for untrusted dynamic data; all elements and text nodes are created using `document.createElement()` and `node.textContent`.
   * **Client-Side State Tracking:** Browser `localStorage` holds theme preferences, anonymous device UUIDs, and a collection of reported paper IDs to immediately disable buttons for already-reported files.

   ---

   ### 2.2 API & Routing Layer (FastAPI Gateway)
   * **Technology Stack:** FastAPI, Pydantic V2, Starlette, Uvicorn.
   * **Responsibilities:**
   * **Request Validation:** Strict parsing of multipart form-data, path parameters, query parameters, and JSON payloads.
   * **CORS Management:** Restricts browser execution to trusted domains configured in `ALLOWED_ORIGINS`.
   * **Dependency Injection:** Utilizes FastAPI’s `Depends(get_db)` to supply isolated, transaction-safe SQLAlchemy sessions per request.
   * **Error Boundary:** Catches domain-specific exceptions (`FileTooLargeError`, `InvalidPdfError`) and converts them into standardized HTTP responses (400, 404, 409, 422).

   ---

   ### 2.3 Services & Processing Layer

   #### A. Storage & Ingestion Service (`storage.py`)
   * **Chunked Streaming Engine:** Ingests uploads in **1 MiB increments** (`CHUNK_SIZE = 1024 * 1024`). Large files never load completely into server RAM.
   * **Cryptographic Integrity:** Updates a SHA-256 digest on the fly as chunks arrive.
   * **Magic Byte Security:** Inspects the first 5 bytes of the file buffer to enforce the `b"%PDF-"` file signature.
   * **Cloud Persistence Adapter:** Uploads the verified binary to Supabase Storage and wipes temporary local files immediately.

   #### B. Two-Tier Hybrid Document Scanner (`ai_scanner.py`)
   * **Purpose:** Ensures submitted documents are genuine university examination papers, tests, or academic assignments, rejecting spam and unrelated files.
   * **Tier 1 (Fast Local Path):** PyMuPDF (`fitz`) extracts digital text from pages 1 and 2 in **~2-5 milliseconds**. Evaluates 20 academic keywords and regex patterns for course codes (`22MAT122`) and question numbering (`Q1`, `1. Expand...`).
   * **Tier 2 (AI Vision Fallback):** If a document is a camera photo or scanned photocopy without digital text, the file stream is passed to **Google Gemini 3.8 Flash**. Enforces structured JSON output (`GenerateContentConfig(response_mime_type="application/json")`) to obtain an OCR-backed verification verdict.

   ---

   ### 2.4 Persistence & Storage Layer
   * **Technology Stack:** SQLAlchemy 2.0 Declarative ORM, PostgreSQL (hosted on Supabase), Psycopg 3 binary driver.
   * **Architectural Guarantees:**
   * **Connection Pooling with Health Check:** Configured with `pool_pre_ping=True` to eliminate broken pipe errors caused by cloud database idle timeouts.
   * **Prevent Redundant Queries:** Configured with `expire_on_commit=False` so committed entities can be serialized directly without triggering re-fetch `SELECT` queries.
   * **Relational Integrity:** Implements `ondelete="CASCADE"` foreign key relationships between `papers` and `paper_reports`.

   ---

   ### 2.5 External Cloud Infrastructure
   1. **Supabase PostgreSQL:** Managed relational database storing structured paper records, report logs, and course hub links.
   2. **Supabase Object Storage:** Distributed, persistent bucket (`past_papers`) serving public PDF downloads via high-speed CDN URLs.
   3. **Google Gemini Generative AI:** Multimodal vision API used strictly on-demand for OCR verification of scanned physical question papers.

   ---

   ## 3. Key End-to-End Workflows & Sequence Diagrams

   ### 3.1 The Ingestion, Hashing & Storage Pipeline

   This workflow describes the complete lifecycle of a paper upload from client submission to database persistence:

   ```text
   Browser Client               FastAPI Router               storage.py              ai_scanner.py          PostgreSQL / Supabase
         │                            │                           │                        │                          │
         │ 1. POST /api/papers        │                           │                        │                          │
         │    (Multipart FormData)    │                           │                        │                          │
         ├───────────────────────────►│                           │                        │                          │
         │                            │ 2. Stream & Hash          │                        │                          │
         │                            ├──────────────────────────►│                        │                          │
         │                            │                           │ 3. Buffer 1MB Chunks   │                          │
         │                            │                           │    & Compute SHA-256   │                          │
         │                            │                           │ 4. Verify b"%PDF-"     │                          │
         │                            │                           │    Magic Signature     │                          │
         │                            │ 5. Return (temp_path,     │                        │                          │
         │                            │    file_hash)             │                        │                          │
         │                            │◄──────────────────────────┤                        │                          │
         │                            │                                                    │                          │
         │                            │ 6. Check Duplicate Hash: SELECT FROM papers        │                          │
         │                            ├──────────────────────────────────────────────────────────────────────────────►│
         │                            │◄──────────────────────────────────────────────────────────────────────────────┤
         │                            │    [If Match: Raise HTTP 409 Conflict & Unlink File]                          │
         │                            │                                                    │                          │
         │                            │ 7. Run AI Document Verification                    │                          │
         │                            ├───────────────────────────────────────────────────►│                          │
         │                            │                                                    │ 8. Local Lexical or      │
         │                            │                                                    │    Gemini 3.8 Flash OCR  │
         │                            │ 9. Verdict: {"is_exam": true/false}                │                          │
         │                            │◄───────────────────────────────────────────────────┤                          │
         │                            │    [If False: Raise HTTP 400 Bad Request & Unlink File]                       │
         │                            │                                                                               │
         │                            │ 10. store_pdf(temp_path, file_hash)                                           │
         │                            ├──────────────────────────►│                                                   │
         │                            │                           │ 11. Upload binary to Supabase "past_papers"       │
         │                            │                           │     Bucket & Unlink Local Temp File               │
         │                            │ 12. Return Permanent      │                                                   │
         │                            │     Supabase CDN URL      │                                                   │
         │                            │◄──────────────────────────┤                                                   │
         │                            │                                                                               │
         │                            │ 13. INSERT INTO papers (title, branch, course_code, file_url, file_hash...)   │
         │                            ├──────────────────────────────────────────────────────────────────────────────►│
         │                            │◄──────────────────────────────────────────────────────────────────────────────┤
         │ 14. HTTP 201 Created       │                                                                               │
         │     (PaperResponse JSON)   │                                                                               │
         │◄───────────────────────────┤                                                                               │
   ```

   ---

   ### 3.2 The Two-Tier Hybrid AI Document Verification Engine

   How PaperTrail achieves **sub-5ms verification for digital files** while retaining **multimodal AI accuracy for scanned photos**:

   ```text
                        Incoming Temporary PDF File
                                    │
                                    ▼
            ┌──────────────────────────────────────────────────┐
            │     TIER 1: FAST LOCAL LEXICAL CHECK (~2-5ms)    │
            │  PyMuPDF (fitz) opens document in memory         │
            │  Extracts digital text from pages: min(2, len)   │
            └────────────────────────┬─────────────────────────┘
                                    │
                        Is digital text present?
                                    │
                  ┌────────────────┴────────────────┐
               YES│                                 │NO (Scanned Image/Photo)
                  ▼                                 ▼
      ┌───────────────────────────┐     ┌───────────────────────────┐
      │ Check Academic Keywords   │     │ TIER 2: GEMINI 3.8 FLASH  │
      │ & Regex Patterns:         │     │ Upload PDF stream to      │
      │ - 20 Exam Keywords        │     │ Google Generative AI      │
      │ - Course Code Regex:      │     │                           │
      │   [a-z]{2,4}\d{2,4}       │     │ Prompt: Academic Exam?    │
      │ - Question Patterns:      │     │ Config: Response MIME     │
      │   (Q1, Question 2, 1. ...)│     │ application/json          │
      └─────────────┬─────────────┘     └─────────────┬─────────────┘
                  │                                 │
      Score >= 2 OR 1 + Pattern?                    │
                  │                                 │
            ┌───────┴───────┐                         ▼
         YES│             NO│            Parses Structured JSON
            ▼               ▼            {"is_exam": bool, "reason": str}
      [ ACCEPT PAPER ]      └─────────────────────────┬─────────────┘
      (Return in ~2ms)                                │
                                             ┌───────┴───────┐
                                          YES│             NO│
                                             ▼               ▼
                                       [ ACCEPT PAPER ] [ REJECT PAPER ]
   ```

   ---

   ### 3.3 Real-Time Debounced Search & Discovery Flow

   ```text
   Student Types in Search Filter ──► [ 350ms Timer Reset ] (Debounce Buffer)
                                                │
                                                ▼ (Timer Expires)
                                    Build URLSearchParams
                                    /api/papers?semester=3&branch=CSE&course_code=22MAT
                                                │
                                                ▼
                                    FastAPI /api/papers
                                                │
                                                ▼
                              PostgreSQL Dynamic Filter Query
                              - semester == 3 (exact)
                              - branch ILIKE 'CSE' (case-insensitive)
                              - course_code ILIKE '%22MAT%' (substring match)
                                                │
                                                ▼
                                    Return JSON List of Papers
                                                │
                                                ▼
                                    Frontend renders cards via
                                    document.createElement() (Safe from XSS)
   ```

   ---

   ### 3.4 Atomic Download Tracking Flow

   To prevent download counter spoofing and ensure that metrics reflect real file usage:

   ```text
   1. User clicks "Download PDF" on UI Card
            │
            ▼
   2. Frontend issues request: GET /api/papers/{paper_id}/download
            │
            ▼
   3. FastAPI executes:
      SELECT FROM papers WHERE id = paper_id
      paper.download_count += 1
      db.commit() (Atomic update in PostgreSQL)
            │
            ▼
   4. Backend responds with JSON:
      {"id": 5, "file_url": "https://supabase.../hash.pdf", "download_count": 42}
            │
            ▼
   5. Browser receives response:
      - Updates download count badge on UI card
      - Injects a temporary <a download href="..."> tag
      - Triggers native browser download dialog
   ```

   ---

   ### 3.5 Abuse Prevention, Device Fingerprinting & Auto-Removal Flow

   Protects community moderation from automated spam attacks and avoids accidental data loss:

   ```text
   User Submits Report on Paper #10
                  │
                  ▼
   Browser attaches header: X-Device-Id: <UUIDv4 from localStorage>
                  │
                  ▼
   FastAPI reads X-Device-Id
   Queries paper_reports: (paper_id == 10 AND device_id == UUID)
                  │
         ┌───────┴───────┐
      YES│             NO│
         ▼               ▼
   HTTP 400 Bad Request   Insert into paper_reports
   "Already submitted     paper.report_count += 1
   a report for this     db.commit()
   paper."                       │
                                 ▼
                     Is report_count >= 5?
                                 │
                        ┌───────┴───────┐
                     YES│             NO│
                        ▼               ▼
               _delete_paper():      Return 201 Created
               1. Remove from        "Report logged."
                  Supabase Bucket
               2. Delete row from DB
                  (Cascading deletes
                  all reports)
               3. Return 200 OK:
                  "Paper removed."
   ```

   ---

   ## 4. Database Architecture & Entity-Relationship Model

   The PostgreSQL schema is normalized into three core entities designed around fast search, referential integrity, and cascading cleanup.

   ```text
   ┌────────────────────────────────────────────────────────┐
   │                         PAPERS                         │
   ├───────────────────┬──────────────────┬─────────────────┤
   │ Column            │ Type             │ Constraints     │
   ├───────────────────┼──────────────────┼─────────────────┤
   │ id                │ INTEGER          │ PK, Index       │
   │ title             │ VARCHAR(255)     │ NOT NULL        │
   │ semester          │ INTEGER          │ NOT NULL        │
   │ branch            │ VARCHAR(100)     │ NOT NULL, Index │
   │ course_code       │ VARCHAR(50)      │ NOT NULL, Index │
   │ exam_type         │ VARCHAR(100)     │ NOT NULL        │
   │ file_url          │ VARCHAR(1000)    │ NOT NULL        │
   │ file_hash         │ VARCHAR(64)      │ UNIQUE, NOT NULL│
   │ download_count    │ INTEGER          │ DEFAULT 0       │
   │ upvotes           │ INTEGER          │ DEFAULT 0       │
   │ downvotes         │ INTEGER          │ DEFAULT 0       │
   │ report_count      │ INTEGER          │ DEFAULT 0       │
   └───────────────────┴─────────┬────────┴─────────────────┘
                                 │
                                 │ 1 : N (CASCADE DELETE)
                                 ▼
   ┌────────────────────────────────────────────────────────┐
   │                      PAPER_REPORTS                     │
   ├───────────────────┬──────────────────┬─────────────────┤
   │ Column            │ Type             │ Constraints     │
   ├───────────────────┼──────────────────┼─────────────────┤
   │ id                │ INTEGER          │ PK, Index       │
   │ paper_id          │ INTEGER          │ FK -> papers.id │
   │ reason            │ VARCHAR(500)     │ NOT NULL        │
   │ device_id         │ VARCHAR(64)      │ NULLABLE, Index │
   │ created_at        │ TIMESTAMPTZ      │ DEFAULT now()   │
   └───────────────────┴──────────────────┴─────────────────┘

   ┌────────────────────────────────────────────────────────┐
   │                    COURSE_RESOURCES                    │
   ├───────────────────┬──────────────────┬─────────────────┤
   │ Column            │ Type             │ Constraints     │
   ├───────────────────┼──────────────────┼─────────────────┤
   │ id                │ INTEGER          │ PK, Index       │
   │ course_code       │ VARCHAR(50)      │ NOT NULL, Index │
   │ description       │ VARCHAR(500)     │ NOT NULL        │
   │ url               │ VARCHAR(1000)    │ NULLABLE        │
   │ created_at        │ TIMESTAMPTZ      │ DEFAULT now()   │
   └───────────────────┴──────────────────┴─────────────────┘
   ```

   ### Indexing Rationale:
   1. **`papers.branch` (B-Tree):** Optimizes exact filtering by engineering department.
   2. **`papers.course_code` (B-Tree):** Accelerates case-insensitive substring searching (`ILIKE '%cs101%'`).
   3. **`papers.file_hash` (Unique B-Tree):** Guarantees constant-time $O(1)$ duplicate lookup.
   4. **`paper_reports.(paper_id, device_id)` (Compound B-Tree):** Speeds up anti-spam checks to sub-millisecond queries.

   ---

   ## 5. Key Design Patterns & Software Engineering Principles

   | Software Pattern | Location in Codebase | Concrete Implementation & Purpose |
   | :--- | :--- | :--- |
   | **Dependency Injection** | `routers/papers.py`<br>`routers/resources.py` | `db: Session = Depends(get_db)` injects an isolated database session per request, ensuring automatic transaction closure. |
   | **Singleton Pattern with Caching** | `app/config.py` | `@lru_cache def get_settings() -> Settings` reads environment variables once from disk, serving all subsequent requests from memory. |
   | **Adapter / Facade Pattern** | `services/storage.py` | Encapsulates the external Supabase Storage SDK behind simple functional facades (`store_pdf`, `hash_to_temporary_file`). |
   | **Strategy / Two-Tier Fallback** | `services/ai_scanner.py` | Evaluates local fast heuristics first (PyMuPDF) before seamlessly delegating to heavy cloud AI (Gemini 3.8 Flash). |
   | **Event Delegation Pattern** | `frontend/app.js` | Single listeners attached to `#papers-list` handle all dynamic Download, View, and Report button clicks without memory leaks. |
   | **Unit of Work / ACID Transactions** | `routers/papers.py` | `db.add()`, `db.commit()`, and `db.refresh()` ensure atomicity across paper ingestion and counter increments. |

   ---

   ## 6. Non-Functional Requirements & Security Guarantees

   ### 1. Memory Safety (Zero-OOM Guarantee)
   * **The Problem:** Cloud hosts (such as Render Free Tier) enforce strict **512 MB RAM limits**. Reading an entire 15 MB file into RAM with multiple users will immediately trigger an Out-Of-Memory (OOM) server kill.
   * **The Defense:** The storage service streams files in fixed **1 MiB byte chunks**. Peak memory usage during file upload remains constant (~1-2 MB) regardless of file size.

   ### 2. Magic Byte Signature Verification
   * **The Problem:** Renaming an executable or malicious script to `exam.pdf` can bypass basic filename extension checks.
   * **The Defense:** `storage.py` reads the actual first 5 bytes from disk. If they do not match `b"%PDF-"`, the file is immediately discarded before database entry.

   ### 3. Anti-Spam Reporting Defense (Campus NAT Friendly)
   * **The Problem:** Tracking reports by IP address fails in university environments because entire dorms/libraries share one public IP via NAT. Conversely, using cookies fails when users switch to incognito mode.
   * **The Defense:** A persistent client UUID (`crypto.randomUUID()`) is saved in browser storage and transmitted via `X-Device-Id`. The database verifies `(paper_id, device_id)`, allowing a student to report different papers freely while completely preventing repeat reports on the same file.

   ### 4. Cross-Site Scripting (XSS) Prevention
   * **The Problem:** Ingesting user-submitted titles or course codes and injecting them via `element.innerHTML` allows malicious script execution.
   * **The Defense:** The frontend strictly uses `document.createElement()` and `node.textContent` for all text rendering, neutralizing any embedded `<script>` or HTML tags.
