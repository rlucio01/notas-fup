import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Capture from "./Capture";

const urlParams = new URLSearchParams(window.location.search);
const isCaptureWindow = urlParams.get("w") === "capture";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isCaptureWindow ? <Capture /> : <App />}
  </React.StrictMode>,
);
