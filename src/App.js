import React, { useState } from "react";
import Navbar from "./components/Navbar";
import Map from "./components/Map";

function App() {
  const [loading, setLoading] = useState(true);

  return (
    <div>
      <Navbar />
      
      {/* Loading message below navbar */}
      {loading && (
        <h3 style={{ textAlign: "center", marginTop: "10px", color: "#555" }}>
          Loading...
        </h3>
      )}

      <Map setLoading={setLoading} />
    </div>
  );
}

export default App;
