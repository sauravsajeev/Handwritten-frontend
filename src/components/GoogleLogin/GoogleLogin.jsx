

import React, { useEffect,useState } from "react";
import { useNavigate } from "react-router-dom";
import "./GoogleLogin.css";

function GoogleLogin({ setUser }) {
  const navigate = useNavigate();
  const [showAbout, setShowAbout] = useState(false)
  useEffect(() => {
    // Parse query params from URL if redirected back from backend
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const name = params.get("name");
    const google_id = params.get("google_id");

    if (email && name && google_id) {
      const user = { email, name, google_id };
      
      // Save to localStorage
      localStorage.setItem("user", JSON.stringify(user));
      
      // Set user state
      setUser(user);

      // Navigate to home page
      navigate("/");
    }
  }, [navigate, setUser]);

  const handleLogin = () => {
    window.location.href = (import.meta.env.VITE_LOGIN_REDIRECT_URL);
  };
 const toggleAbout = () => {
    setShowAbout(!showAbout)
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
       <img
        src="/images/logo1.gif"   // put your GIF in public/images/
        alt="Handwritten Logo Animation"
        className="logoimg"
      />
      <button
        onClick={handleLogin}
        className="signinbutton"
      >
        Sign in with Google
      </button>
     <button
         onClick={toggleAbout}
        onMouseEnter={() => setShowAbout(true)}
      //onMouseLeave={() => setShowAbout(false)}
        className="about text-sm transition-colors duration-200"
      >
        About Us
      </button>

       <div className="relative w-full flex justify-center">
        <div
          className={`mt-4 transition-all duration-300 ease-in-out ${
            showAbout ? "transform translate-y-0 opacity-100 max-h-96" : "transform translate-y-8 opacity-0 max-h-0"
          } overflow-hidden`}
        >
          <div className="p-4 rounded-lg max-w-md text-center text-gray-300 text-sm leading-relaxed">
            <h3 className="text-white font-semibold mb-2">About Us</h3>
            <p>
              At Handwritten, we make it easy to turn handwritten notes into clean, digital documents. Our AI-powered tool quickly recognizes handwriting and converts it into editable, searchable text, helping students, professionals, and creators save time, stay organized, and carry their ideas anywhere with ease.<br /><br />Developed by <i style={{color:"red",fontStyle:"normal"}}>Saudu</i>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GoogleLogin;
