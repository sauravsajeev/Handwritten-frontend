"use client"

// src/components/Home.js
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom" // Using React Router instead of Next.js router
import "./Home.css"
import { io } from "socket.io-client"
import GoogleLogin from "../GoogleLogin/GoogleLogin"
import Sidebar from "../Sidebar/Sidebar"

function Home() {
  const [file, setFile] = useState(null)
  const [imgSrc, setImgSrc] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [user, setUser] = useState(null)
  // OCR results
  const [results, setResults] = useState(null)
  const [pages, setPages] = useState([])
  const [currentPage, setCurrentPage] = useState(0)
  const [outText, setOutText] = useState("")
  const [loading, setLoading] = useState(false)
  const [showLines, setShowLines] = useState(true)
  const [showHandwritten, setShowHandwritten] = useState(false)
  const [hasRecognized, setHasRecognized] = useState(false)
  // crop states (images only)
  const [crop, setCrop] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [croppingEnabled, setCroppingEnabled] = useState(false)
  const [confirmedCrop, setConfirmedCrop] = useState(false)

  const [socket, setSocket] = useState()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [savedDocuments, setSavedDocuments] = useState([])
  // file status ("Uploaded" or "File changed")
  const [fileStatus, setFileStatus] = useState("no file chosen")

  const [errorOpen, setErrorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const imgRef = useRef(null)
  const overlayRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const navigate = useNavigate() // Using React Router navigate instead of Next.js router

  // Reset state
  const resetAll = () => {
    setFile(null)
    setImgSrc(null)
    setPdfFile(null)
    setResults(null)
    setPages([])
    setCurrentPage(0)
    setOutText("")
    setCrop(null)
    setHasRecognized(false)
    setConfirmedCrop(false)
    setCroppingEnabled(false)
    setLoading(false)
    setFileStatus("")
    setErrorOpen(false)
    setErrorMessage("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    resetAll()
    setFile(f)

    if (f.type.startsWith("image/")) {
      setImgSrc(URL.createObjectURL(f))
      setPdfFile(null)
    } else if (f.type === "application/pdf") {
      setPdfFile(f)
      setImgSrc(null)
    }

    // ✅ Show "File changed" for 1.5s, then "Uploaded"
    setFileStatus("File changed")
    setTimeout(() => setFileStatus("Uploaded"), 1500)
  }
  useEffect(() => {
    console.log("[v0] Initializing socket connection of home")
    const s = io(import.meta.env.VITE_SERVER_URL)
    setSocket(s)

    return () => {
      s.disconnect()
      s.removeAllListeners()
    }
  }, [])
  const toggleSidebar = () => {
    console.log("[v0] Toggling sidebar, current state:", sidebarOpen)
    setSidebarOpen(!sidebarOpen)
    loadSavedDoc()
  }

  const openDocument = (documentId) => {
    console.log("[v0] Opening document:", documentId)
    setSidebarOpen(false)
    navigate(`/documents/${documentId}`)
    // Here you would typically load the document data
    // For now, we'll just close the sidebar
  }
  const loadSavedDoc = () => {
    if (socket == null) {
      return
    }
    const savedUser = JSON.parse(localStorage.getItem("user"))

    socket.once("all-documents", (documents) => {
      setSavedDocuments(documents)
      console.log("[v0] Fetched documents:", documents)
    })

    if (savedUser?.google_id) {
      console.log("Trying to Fetch documents ")
      socket.emit("find-all", savedUser?.google_id)
    }
  }
  const deleteSavedDoc = (id) => {
    if (socket == null) {
      return
    }
    socket.emit("delete-document", id)
  }
  const handleStartCrop = () => {
    setCroppingEnabled(true)
    setConfirmedCrop(false)
    setCrop(null)
  }

  const handleConfirmCrop = () => {
    if (!crop || !imgRef.current) return

    const img = imgRef.current
    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height

    const canvas = document.createElement("canvas")
    canvas.width = Math.abs(crop.w * scaleX)
    canvas.height = Math.abs(crop.h * scaleY)

    const ctx = canvas.getContext("2d")
    ctx.drawImage(
      img,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.w * scaleX,
      crop.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    )

    const croppedDataUrl = canvas.toDataURL("image/png")
    setImgSrc(croppedDataUrl)
    setConfirmedCrop(true)
    setCroppingEnabled(false)
    setCrop(null)
  }
  const showBackendBusy = useCallback(() => {
    setErrorMessage("Backend Server is busy try later")
    setErrorOpen(true)
  }, [])
  const handleRecognize = async () => {
    if (imgSrc && croppingEnabled && !confirmedCrop) return
    setLoading(true)
    setOutText("Senting to Server...")
    setHasRecognized(true)
    try {
      const form = new FormData()

      if (pdfFile) {
        form.append("file", pdfFile, pdfFile.name)
      } else if (imgSrc) {
        const res = await fetch(imgSrc)
        const blob = await res.blob()
        form.append("file", blob, "image.png")
      }
      const savedUser = JSON.parse(localStorage.getItem("user"))
      if (savedUser?.google_id) {
        form.append("user_id", savedUser?.google_id)
      } else {
        console.log("No user found")
      }
      if (showHandwritten) {
        form.append("handwritten", "true")
      } else {
        form.append("handwritten", "false")
      }
      const pollForResult = async () => {
      const apiRes  = await fetch(import.meta.env.VITE_OCR_URL + "/convert", {
        method: "POST",
        body: form,
        cache: "no-store",
      })
      if (!apiRes.ok) {
        // Optional: log status for diagnostics
        console.warn("[v0] OCR backend returned non-OK status:", apiRes.status)
        showBackendBusy()
        throw new Error(`Backend unavailable (status ${apiRes.status})`)
      }
      const data = await apiRes.json()
      console.log("OCR Response:", data)
      if (data.status === "queued") {
        // Show queue position
        if (data.queue_position) == 2{
          setOutText("Processing...")
        }
        setOutText(`Waiting in queue: ${data.queue_position}`)

        // Wait 3 seconds and retry
        await new Promise((resolve) => setTimeout(resolve, 3000))
        return pollForResult()
      }
      if (data.status === "done") {
      if (data.pages) {
        // Multi-page PDF
        setPages(data.pages)
        setCurrentPage(0)
        setResults(null)
        setImgSrc(null)

        const firstPage = data.pages[0]
        const text = (firstPage?.results?.sentences || []).map((s) => s.corrected_text).join("\n")
        setOutText(text || "")
      } else {
        // Single image or single-page PDF
        setPages([])
        setResults(data)
        //if (data.preview_url) setImgSrc(import.meta.env.VITE_OCR_URL + data.preview_url)
        const sentences = data?.results?.sentences || []
        setOutText(sentences.length ? sentences.map((s) => s.corrected_text).join("\n") : "No Text Found")
      }
    }
  }
   await pollForResult()
    } catch (err) {
      console.error(err)
      setOutText("")
      showBackendBusy()
    } finally {
      setLoading(false)
    }
  }

  // Decide which image to display
  const [imgReloadCount, setImgReloadCount] = useState(0)
  const currentImageSrc = useMemo(() => {
    const base = imgSrc ?? (pages.length > 0 ? import.meta.env.VITE_OCR_URL + pages[currentPage].preview_url : null)
    if (!base) return null
    // Don't add cache buster for local data/blob URLs
    if (base.startsWith("data:") || base.startsWith("blob:")) return base
    const sep = base.includes("?") ? "&" : "?"
    return `${base}${sep}v=${imgReloadCount}`
  }, [imgSrc, pages, currentPage, imgReloadCount])

  // Draw bounding boxes for lines
  const drawBoxes = useCallback(() => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return

    let lineData = []
    let imgW = null,
      imgH = null

    if (pages.length > 0) {
      const p = pages[currentPage]
      lineData = p?.results?.lines || []
      imgW = p?.image_w
      imgH = p?.image_h
    } else if (results) {
      lineData = results?.results?.lines || []
      imgW = results?.image_w
      imgH = results?.image_h
    }

    const ctx = canvas.getContext("2d")
    const rect = { width: img.width, height: img.height }
    canvas.width = rect.width
    canvas.height = rect.height

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!showLines || !Array.isArray(lineData) || !imgW || !imgH) return

    const rx = rect.width / imgW
    const ry = rect.height / imgH
    ctx.lineWidth = 2
    ctx.strokeStyle = "#646cff"
    for (const b of lineData) {
      ctx.strokeRect(b.x * rx, b.y * ry, b.w * rx, b.h * ry)
    }
  }, [pages, currentPage, results, showLines])

  useEffect(() => {
    drawBoxes()
  }, [drawBoxes])

  //saves User Logins
  useEffect(() => {
    const savedUser = localStorage.getItem("user")
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])
  useEffect(() => {
    //delete files on refrest
    const handleUnload = async () => {
      const savedUser = JSON.parse(localStorage.getItem("user"))
      if (savedUser?.google_id) {
        navigator.sendBeacon(import.meta.env.VITE_OCR_URL + "/clear", JSON.stringify({ user_id: savedUser.google_id }))
      }
    }
    window.addEventListener("beforeunload", handleUnload)
    return () => window.removeEventListener("beforeunload", handleUnload)
  }, [])

  // Update extracted text when switching PDF page
  useEffect(() => {
    if (pages.length > 0) {
      const current = pages[currentPage]
      const text = (current?.results?.sentences || []).map((s) => s.corrected_text).join("\n")
      setOutText(text || "")
    }
  }, [currentPage, pages])

  // Cropper handlers
  const handleMouseDown = (e) => {
    if (!overlayRef.current || !croppingEnabled) return
    const rect = overlayRef.current.getBoundingClientRect()
    setIsDrawing(true)
    setCrop({ x: e.clientX - rect.left, y: e.clientY - rect.top, w: 0, h: 0 })
  }

  const handleMouseMove = (e) => {
    if (!isDrawing || !crop || !croppingEnabled) return
    const rect = overlayRef.current.getBoundingClientRect()
    const w = e.clientX - rect.left - crop.x
    const h = e.clientY - rect.top - crop.y
    setCrop({ ...crop, w, h })
  
  }

  const handleMouseUp = () => setIsDrawing(false)

  // Navigate to TextEditor
  const handleMakePdf = () => {
    console.log("[v0] Making PDF with extracted text") // Added debug logging
    const newId = Date.now().toString()

    if (pages.length > 0) {
      // Multi-page PDF - pass all pages with their text content
      const multiPageData = pages.map((page, index) => ({
        pageNumber: index + 1,
        content: (page?.results?.sentences || []).map((s) => s.corrected_text).join("\n"),
      }))
      console.log("[v0] Storing multi-page data:", multiPageData) // Added debug logging
      localStorage.setItem("multiPageData", JSON.stringify(multiPageData))
      localStorage.removeItem("initialText") // Clear single page data
    } else {
      // Single page - keep existing behavior
      console.log("[v0] Storing single page text:", outText) // Added debug logging
      localStorage.setItem("initialText", outText)
      localStorage.removeItem("multiPageData") // Clear multi-page data
    }

    navigate(`/documents/${newId}`)
  }

  return (
    <div className="HomeBase">
      {!user ? (
        <div className="signinp">
          <GoogleLogin setUser={setUser} />
        </div>
      ) : (
        <div>
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            savedDocuments={savedDocuments}
            onOpenDocument={openDocument}
            deleteSavedDoc={deleteSavedDoc}
          />
          <div className="Homie">
            <div className="Logout">
              <img
                src="/images/logo.gif" // put your GIF in public/images/
                alt="Handwritten Logo Animation"
                style={{ marginTop: 5, cursor: "pointer" }}
                className="h-[50px] lg:h-[100px]"
                onClick={toggleSidebar}
              />
              <button
                onClick={async () => {
                  const savedUser = JSON.parse(localStorage.getItem("user"))
                  if (savedUser?.google_id) {
                    await fetch(import.meta.env.VITE_OCR_URL + "/clear", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ user_id: savedUser.google_id }),
                    })
                  }
                  localStorage.removeItem("user") // clear storage
                  setUser(null)
                }}
                style={{ padding: "1px 12px" }}
                className="w-[40px] h-[15px] lg:w-[100px] lg:h-[30px]"
              >
                Logout
              </button>
            </div>
            <div className="Home" style={{ margin: 24 }}>
              <div className={`right ${file || imgSrc ? "slide-right" : ""}`}>
                <h3>
                  Welcome <i>{user.name.split(" ")[0]}</i>
                </h3>

                <div
                  className={`OCR ${file || imgSrc ? "s" : ""}`}
                  style={{ display: "flex", gap: 12, alignItems: "center" }}
                >
                  <div>
                    <label
                      style={{
                        display: "inline-block",
                        padding: "8px 16px",
                        background: loading ? "#9e9e9e" : "#1976d2", // gray when disabled
                        color: "white",
                        borderRadius: "4px",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      Choose File
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,.pdf"
                        style={{ display: "none" }}
                        disabled={loading} // ✅ disable while recognizing
                      />
                    </label>
                    {/* ✅ Show file status */}
                    {fileStatus && <span style={{ color: "white", marginLeft: 10 }}>{fileStatus}</span>}
                  </div>
                  <div>
                    <button
                      onClick={handleRecognize}
                      disabled={(croppingEnabled && !confirmedCrop) || loading || !(imgSrc || pdfFile)}
                      className={
                        (croppingEnabled && !confirmedCrop) || loading || !(imgSrc || pdfFile) ? "" : "RecognizeButton"
                      }
                    >
                      {loading ? "Extracting..." : "Extract Text"}
                    </button>

                    {(imgSrc || pdfFile) && (
                      <button
                        onClick={async () => {
                          const savedUser = JSON.parse(localStorage.getItem("user"))
                          if (savedUser?.google_id) {
                            await fetch(import.meta.env.VITE_OCR_URL + "/clear", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ user_id: savedUser.google_id }),
                            })
                          }
                          resetAll()
                        }}
                        disabled={loading}
                        className={loading ? "" : "CancelButton"}
                        style={{
                          marginLeft: 10,
                          padding: "8px 16px",
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none" style={{ marginTop: 2 }}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border border-border accent-blue-600 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      checked={showHandwritten}
                      onChange={(e) => setShowHandwritten(e.target.checked)}
                    />
                    Handwritten
                  </label>
                </div>

                <div className="OutputSection">
                  <div>
                    <h4 style={{ marginTop: 0 }}>Extracted Text</h4>
                    <textarea
                      value={outText}
                      readOnly
                      style={{ background: "#2c2c2c", width: "100%", height: 200, marginTop: 0 }}
                    />
                  </div>
                  {outText && outText !== "Processing..." && !outText.startsWith("Error") && (
                    <button
                      onClick={handleMakePdf}
                      style={{
                        marginTop: 16,
                        padding: "8px 16px",
                        background: "#646cff",
                        color: "white",
                      }}
                    >
                      Make PDF
                    </button>
                  )}
                </div>
              </div>
              <div className={`left ${file || imgSrc ? "slide-left" : ""}`} style={{ marginLeft: 40 }}>
                {/* PDF navigation */}
                {pages.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))} disabled={currentPage === 0}>
                      Prev Page
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, pages.length - 1))}
                      disabled={currentPage === pages.length - 1}
                      style={{ marginLeft: 8 }}
                    >
                      Next Page
                    </button>
                    <span style={{ marginLeft: 12 }}>
                      Page {currentPage + 1} / {pages.length}
                    </span>
                  </div>
                )}

                {/* IMAGE or PDF page preview */}
                {currentImageSrc && (
                  <div className="Borderstage">
                    <div className="stage" style={{ position: "relative", width: 400 }}>
                      {/* Ensure image uses crossOrigin for CORS-safe cropping and triggers draw on load */}
                      <img
                        ref={imgRef}
                        src={
                          currentImageSrc || "/placeholder.svg?height=400&width=400&query=ocr%20preview%20placeholder"
                        }
                        alt="preview"
                        width={400}
                        height={400}
                        style={{ width: 400, display: "block" }}
                        crossOrigin="anonymous"
                        loading="eager"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onLoad={drawBoxes}
                        onError={() => {
                          console.warn("[v0] Preview failed to load, retrying with cache-buster...", currentImageSrc)
                          setImgReloadCount((n) => n + 1)
                        }}
                        key={currentImageSrc}
                      />
                      {/* Boxes canvas overlay */}
                      <canvas
                        ref={canvasRef}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          pointerEvents: "none",
                        }}
                        aria-hidden="true"
                      />
                      {/* Optional interactive overlay for cropping; keep your own handlers/conditions */}
                      {imgSrc && croppingEnabled && (
                        <canvas
                          ref={overlayRef}
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            cursor: "crosshair",
                          }}
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Crop controls */}
                <div className="croptools">
                  {((file && outText && outText !== "Processing..." && !outText.startsWith("Error")) || imgSrc) && (
                    <label
                      className="inline-flex items-center gap-2 cursor-pointer select-none"
                      style={{ marginTop: 15, marginRight: 20 }}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border border-border accent-blue-600 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        checked={showLines}
                        onChange={(e) => setShowLines(e.target.checked)}
                      />
                      Lines
                    </label>
                  )}
                  {imgSrc && !croppingEnabled && !confirmedCrop && !loading && !hasRecognized && (
                    <button
                      onClick={handleStartCrop}
                      className="hidden lg:block"
                      style={{
                        marginTop: 10,
                        background: "#646cff",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      Crop
                    </button>
                  )}
                  {imgSrc && croppingEnabled && crop && !loading && (
                    <button
                      onClick={handleConfirmCrop}
                      style={{
                        marginTop: 10,
                        background: "green",
                        color: "white",
                        display: "block",
                        cursor: "pointer",
                      }}
                    >
                      Confirm Crop
                    </button>
                  )}
                </div>
                {imgSrc && croppingEnabled && <p>Left click & drag through the image to select</p>}
              </div>
            </div>
          </div>
        </div>
      )}
      {errorOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="backend-busy-title"
          aria-describedby="backend-busy-desc"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setErrorOpen(false)}
        >
          <div
            style={{
              background: "#1f1f1f",
              color: "white",
              border: "1px solid #444",
              borderRadius: 8,
              width: "min(90vw, 420px)",
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="backend-busy-title" style={{ marginTop: 0, marginBottom: 8 }}>
              Error
            </h4>
            <p id="backend-busy-desc" style={{ margin: 0 }}>
              {errorMessage || "Backend Server is busy try later"}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setErrorOpen(false)}
                style={{
                  padding: "8px 12px",
                  background: "#646cff",
                  color: "white",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
