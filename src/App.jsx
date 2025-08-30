// src/App.js
import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./components/Home/Home";
import TextEditor from "./components/PdfEditor/TextEditor"; 

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/documents/:id" element={<TextEditor />} /> 
    </Routes>
  );
}

export default App;
