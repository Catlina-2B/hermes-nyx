import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CompanionApp from "./CompanionApp";
import "../styles/global.css";

createRoot(document.getElementById("companion-root")!).render(
  <StrictMode>
    <CompanionApp />
  </StrictMode>,
);
