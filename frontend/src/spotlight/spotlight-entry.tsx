import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SpotlightApp from "./SpotlightApp";
import "../styles/global.css";

createRoot(document.getElementById("spotlight-root")!).render(
  <StrictMode>
    <SpotlightApp />
  </StrictMode>,
);
