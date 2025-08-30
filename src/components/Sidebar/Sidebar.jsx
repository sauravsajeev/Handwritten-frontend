"use client"

import { useState, useEffect } from "react"
import "./Sidebar.css"

const Sidebar = ({ isOpen, onClose, savedDocuments, onOpenDocument,deleteSavedDoc}) => {
  const [documents, setDocuments] = useState([])

  useEffect(() => {
    // Mock data for demonstration - replace with actual API call
    // const mockDocuments = [
    //   { id: "1", title: "Handwritten Text Recognition", date: "2 hours ago", type: "image" },
    //   { id: "2", title: "Clear user folder on login", date: "1 day ago", type: "pdf" },
    //   { id: "3", title: "Git push error fix", date: "2 days ago", type: "image" },
    //   { id: "4", title: "Better TrOCR setup", date: "3 days ago", type: "pdf" },
    //   { id: "5", title: "Dark theme design", date: "1 week ago", type: "image" },
    //   { id: "6", title: "GPU backend hosting options", date: "1 week ago", type: "pdf" },
    //   { id: "7", title: "Google OAuth integration", date: "2 weeks ago", type: "image" },
    //   { id: "8", title: "Fixing dark circles", date: "2 weeks ago", type: "pdf" },
    //   { id: "9", title: "Samsung HDR colorspace", date: "3 weeks ago", type: "image" },
    //   { id: "10", title: "AE plugin for speed control", date: "1 month ago", type: "pdf" },
    // ]
    setDocuments(savedDocuments)
  }, [savedDocuments])

  const handleDocumentClick = (doc) => {
    console.log("[v0] Opening document:", doc.name)
    if (onOpenDocument) {
      onOpenDocument(doc._id)
    }
  }
  const handleDeleteClick = (doc) => {
    console.log("[v0] deleting document:", doc.name)
      deleteSavedDoc(doc._id)
      setDocuments(documents.filter((item) => item._id !== doc._id));
  }

//   const handleNewDocument = () => {
//     console.log("[v0] Creating new document")
//     // Reset the current document state or navigate to new document
//     window.location.reload()
//   }

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        {/* <div className="sidebar-header">
          <button className="new-document-btn" onClick={handleNewDocument}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Document
          </button>
        </div> */}

        <div className="sidebar-content">
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Recent Documents
            </div>
          </div>

          <div className="documents-list">
            {documents.map((doc) => (
              <div key={doc._id} className="document-item" >
                <div className="document-icon">
                  {doc.type === "pdf" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21,15 16,10 5,21" />
                    </svg>
                  )}
                </div>
                <div className="document-info">
                  <div className="document-title" onClick={() => handleDocumentClick(doc)}>{doc.name}</div>
                  <div className="document-date" onClick={() => handleDeleteClick(doc)}><svg
  xmlns="http://www.w3.org/2000/svg"
  width="14"
  height="14"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
>
  <polyline points="3 6 5 6 21 6" />
  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  <path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
</svg></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default Sidebar
