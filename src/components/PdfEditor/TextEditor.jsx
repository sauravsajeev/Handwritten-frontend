"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import Quill from "quill"
import "quill/dist/quill.snow.css"
import { io } from "socket.io-client"
import jsPDF from "jspdf"
import "./TextEditor.css"

const SAVE_INTERVAL_MS = 2000
const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ size: ["small", false, "large", "huge"] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ indent: "-1" }, { indent: "+1" }],
  [{ direction: "rtl" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
]

export default function TextEditor() {
  const { id: documentId } = useParams()
  const [socket, setSocket] = useState()
  const [quill, setQuill] = useState()
  const [name, setName] = useState("Untitled")
  const [dropDown, setDropDown] = useState(false)
  const [pages, setPages] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageContents, setPageContents] = useState({})

  useEffect(() => {
    console.log("[v0] Initializing socket connection")
    const s = io(import.meta.env.VITE_SERVER_URL)
    setSocket(s)

    return () => {
      s.disconnect()
      s.removeAllListeners()
    }
  }, [])

  useEffect(() => {
    if (socket == null || quill == null) return

    console.log("[v0] Setting up document loading for documentId:", documentId)
    socket.once("load-document", (document) => {
      if (document === "Document") {
        alert("You do not have access to this document.")
        quill.setText("Access Denied")
        quill.disable()
        return
      }
      console.log("[v0] Document loaded:", document)
      setName(document.name)

      const multiPageData = localStorage.getItem("multiPageData")
      const initialText = localStorage.getItem("initialText")

      console.log("[v0] Checking localStorage - multiPageData:", !!multiPageData, "initialText:", !!initialText)

      if (multiPageData) {
        const parsedPages = JSON.parse(multiPageData)
        console.log("[v0] Loading multi-page OCR data:", parsedPages)

        setPages([])

        if (parsedPages.length > 0) {
          quill.setText(parsedPages[0].content)
          setPageContents({ 1: { ops: [{ insert: parsedPages[0].content + "\n" }] } })
        }

        if (parsedPages.length > 1) {
          let pageIndex = 1
          const addNextPage = () => {
            if (pageIndex < parsedPages.length) {
              console.log("[v0] Adding page", pageIndex + 1)
              socket.emit("add-page")
              pageIndex++
              setTimeout(addNextPage, 200)
            } else {
              setTimeout(() => {
                parsedPages.forEach((pageData, index) => {
                  const pageNumber = index + 1
                  const content = { ops: [{ insert: pageData.content + "\n" }] }
                  console.log("[v0] Saving content to page", pageNumber)
                  socket.emit("save-page", { pageNumber, content })
                })
              }, 500)
            }
          }
          setTimeout(addNextPage, 300)
        }

        localStorage.removeItem("multiPageData")
      } else if (initialText) {
        console.log("[v0] Loading single page OCR text")
        quill.setText(initialText)
        setPages([{ pageNumber: 1, content: { ops: [{ insert: initialText + "\n" }] } }])
        localStorage.removeItem("initialText")
      } else if (document.pages && document.pages.length > 0) {
        console.log("[v0] Loading existing document pages")
        setPages(document.pages)
        const firstPage = document.pages[0]
        if (firstPage.content && firstPage.content.ops && firstPage.content.ops.length > 0) {
          quill.setContents(firstPage.content)
          setPageContents((prev) => ({ ...prev, [1]: firstPage.content }))
        }
      } else {
        console.log("[v0] No initial content, clearing loading text")
        quill.setText("")
        setPages([{ pageNumber: 1, content: { ops: [] } }])
      }

      quill.enable()
    })
  
    const docId = documentId || "default-document"
    const savedUser = JSON.parse(localStorage.getItem("user"))
    const ownerid = savedUser?.google_id
    if (ownerid){
    socket.emit("get-document", docId,ownerid)
    }
  }, [socket, quill, documentId])

  useEffect(() => {
    if (socket == null) return

    const handlePageAdded = ({ pageNumber, pages: updatedPages }) => {
      setPages(updatedPages)
    }

    const handlePageDeleted = ({ deletedPage, pages: updatedPages }) => {
      setPages(updatedPages)
      if (currentPage === deletedPage) {
        setCurrentPage(1)
        loadPage(1)
      } else if (currentPage > deletedPage) {
        setCurrentPage((prev) => prev - 1)
      }
    }

    const handlePageLoaded = ({ pageNumber, content }) => {
      if (pageNumber === currentPage) {
        quill.setContents(content)
        setPageContents((prev) => ({ ...prev, [pageNumber]: content }))
      }
    }

    socket.on("page-added", handlePageAdded)
    socket.on("page-deleted", handlePageDeleted)
    socket.on("page-loaded", handlePageLoaded)

    return () => {
      socket.off("page-added", handlePageAdded)
      socket.off("page-deleted", handlePageDeleted)
      socket.off("page-loaded", handlePageLoaded)
    }
  }, [socket, currentPage, quill])

  useEffect(() => {
    if (socket == null || quill == null) return

    const interval = setInterval(() => {
      const content = quill.getContents()
      socket.emit("save-page", { pageNumber: currentPage, content })
      setPageContents((prev) => ({ ...prev, [currentPage]: content }))
    }, SAVE_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [socket, quill, currentPage])

  const addNewPage = () => {
    if (socket) {
      socket.emit("add-page")
    }
  }

  const deletePage = (pageNumber) => {
    if (socket && pages.length > 1) {
      socket.emit("delete-page", pageNumber)
    }
  }

  const loadPage = (pageNumber) => {
    if (socket && quill) {
      const currentContent = quill.getContents()
      socket.emit("save-page", { pageNumber: currentPage, content: currentContent })
      socket.emit("load-page", pageNumber)
      setCurrentPage(pageNumber)
    }
  }

  const exportToPDF = async () => {
    try {
      const pdf = new jsPDF("p", "mm", "a4")
      const pageWidth = 210
      const pageHeight = 297
      const margin = 20
      let yPosition = margin + 10

      const processQuillDelta = (delta, pdf, startY) => {
        let currentY = startY
        const lineHeight = 6
        const maxWidth = pageWidth - margin * 2
        const listCounters = {}
        let currentListType = null
        let currentListLevel = 0
        let pendingListItem = null

        if (!delta || !delta.ops) return currentY

        for (let i = 0; i < delta.ops.length; i++) {
          const op = delta.ops[i]
          if (!op.insert) continue

          const text = op.insert
          const attributes = op.attributes || {}

          if (text === "\n" && attributes.list) {
            pendingListItem = {
              type: attributes.list,
              level: attributes.indent || 0,
            }
            continue
          }

          let fontSize = 12
          let fontStyle = "normal"

          if (attributes.header) {
            fontSize =
              attributes.header === 1
                ? 20
                : attributes.header === 2
                  ? 18
                  : attributes.header === 3
                    ? 16
                    : attributes.header === 4
                      ? 14
                      : attributes.header === 5
                        ? 13
                        : 12
            fontStyle = "bold"
          }

          if (attributes.size) {
            if (attributes.size === "small") fontSize = 10
            else if (attributes.size === "large") fontSize = 16
            else if (attributes.size === "huge") fontSize = 20
          }

          if (attributes.bold && attributes.italic) {
            fontStyle = "bolditalic"
          } else if (attributes.bold) {
            fontStyle = "bold"
          } else if (attributes.italic) {
            fontStyle = "italic"
          }

          pdf.setFont("helvetica", fontStyle)
          pdf.setFontSize(fontSize)

          if (attributes.color) {
            const color = attributes.color
            if (color.startsWith("#")) {
              const r = Number.parseInt(color.slice(1, 3), 16)
              const g = Number.parseInt(color.slice(3, 5), 16)
              const b = Number.parseInt(color.slice(5, 7), 16)
              pdf.setTextColor(r, g, b)
            }
          } else {
            pdf.setTextColor(0, 0, 0)
          }

          let decoratedText = text
          if (attributes.strike) {
            decoratedText = `~~${text}~~`
          }

          let textAlign = "left"
          if (attributes.align) {
            textAlign = attributes.align
          }

          let listPrefix = ""
          let listIndent = 0

          const listInfo =
            pendingListItem || (attributes.list ? { type: attributes.list, level: attributes.indent || 0 } : null)

          if (listInfo) {
            const listType = listInfo.type
            const indent = listInfo.level
            listIndent = (indent + 1) * 10

            if (currentListType !== listType || currentListLevel !== indent) {
              if (listType === "ordered") {
                listCounters[indent] = listCounters[indent] || 0
              }
              currentListType = listType
              currentListLevel = indent
            }

            if (listType === "bullet") {
              listPrefix = "• "
            } else if (listType === "ordered") {
              listCounters[indent] = (listCounters[indent] || 0) + 1
              listPrefix = `${listCounters[indent]}. `
            }

            pendingListItem = null
          } else {
            currentListType = null
            currentListLevel = 0
          }

          if (!text.trim() && !listPrefix) {
            if (text.includes("\n")) {
              currentY += lineHeight
            }
            continue
          }

          const fullText = listPrefix + decoratedText.replace(/\n/g, "")

          const availableWidth = maxWidth - listIndent
          const lines = pdf.splitTextToSize(fullText, availableWidth)

          for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            if (currentY + lineHeight > pageHeight - margin) {
              pdf.addPage()
              currentY = margin + 10
            }

            let xPosition = margin + listIndent
            if (textAlign === "center" && !listInfo) {
              xPosition = pageWidth / 2
            } else if (textAlign === "right" && !listInfo) {
              xPosition = pageWidth - margin
            }

            const finalAlign = listInfo ? undefined : textAlign === "left" ? undefined : textAlign

            pdf.text(lines[lineIndex], xPosition, currentY, {
              align: finalAlign,
            })

            if (attributes.underline) {
              const textWidth = pdf.getTextWidth(lines[lineIndex])
              let underlineX = xPosition
              if (textAlign === "center" && !listInfo) {
                underlineX = xPosition - textWidth / 2
              } else if (textAlign === "right" && !listInfo) {
                underlineX = xPosition - textWidth
              }
              pdf.line(underlineX, currentY + 1, underlineX + textWidth, currentY + 1)
            }

            currentY += lineHeight + (fontSize > 12 ? 2 : 0)
          }

          if (attributes.header) {
            currentY += 3
          }

          if (listInfo) {
            currentY += 1
          }
        }

        return currentY
      }

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) {
          pdf.addPage()
          yPosition = margin + 10
        }

        const pageContent = pageContents[pages[i].pageNumber] || pages[i].content

        if (pageContent && pageContent.ops) {
          yPosition = processQuillDelta(pageContent, pdf, yPosition)
        }

        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(10)
        pdf.setTextColor(128, 128, 128)
        pdf.text(`Page ${i + 1}`, pageWidth - margin - 20, pageHeight - 10)
      }

      pdf.save(`${name || "document"}.pdf`)
      setDropDown(false)
    } catch (error) {
      console.error("Error exporting PDF:", error)
      alert("Error exporting PDF. Please try again.")
    }
  }

  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) return

    wrapper.innerHTML = ""
    const editor = document.createElement("div")
    wrapper.append(editor)
    const q = new Quill(editor, {
      theme: "snow",
      modules: { toolbar: TOOLBAR_OPTIONS },
    })
    q.disable()
    q.setText("Loading...")
    setQuill(q)
  }, [])

  return (
    <>
      <div className="Editor">
        <div className="editor__header">
          <div className="editor__header__top">
            <a href="/">Home</a>
            <div className="editor__share">
              <button
                className="editor__share__button"
                onClick={() => {
                  setDropDown(!dropDown)
                }}
              >
                Share
              </button>
              {dropDown && (
                <div className="editor__dropdown">
                  <p>{window.location.href}</p>
                  <button className="editor__export__button" onClick={exportToPDF}>
                    📄 Export as PDF
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="name">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                if (socket) {
                  socket.emit("rename-document", e.target.value)
                  setName(e.target.value)
                }
              }}
            />
          </div>
          <div className="page__toolbar">
            <div className="page__navigation">
              <button
                className="page__nav__button"
                onClick={() => {
                  if (currentPage > 1) {
                    loadPage(currentPage - 1)
                  }
                }}
                disabled={currentPage <= 1}
              >
                ← Previous
              </button>
              <span className="page__indicator">
                Page {currentPage} of {pages.length}
              </span>
              <button
                className="page__nav__button"
                onClick={() => {
                  if (currentPage < pages.length) {
                    loadPage(currentPage + 1)
                  }
                }}
                disabled={currentPage >= pages.length}
              >
                Next →
              </button>
            </div>
            <div className="page__actions">
              <button className="page__action__button page__add" onClick={addNewPage}>
                + New Page
              </button>
              {pages.length > 1 && (
                <button className="page__action__button page__delete" onClick={() => deletePage(currentPage)}>
                  Delete Page
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="container" ref={wrapperRef}></div>
      </div>
    </>
  )
}
