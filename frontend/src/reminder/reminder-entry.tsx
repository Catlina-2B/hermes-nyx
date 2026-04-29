import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ReminderApp from "./ReminderApp";
import "../styles/global.css";

createRoot(document.getElementById("reminder-root")!).render(
  <StrictMode>
    <ReminderApp />
  </StrictMode>,
);
