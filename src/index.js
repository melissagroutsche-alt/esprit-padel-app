import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppV2 from "./v2/AppV2";
import { AuthProvider } from "./auth/AuthContext";

// Toggle V2 shell. Set to false to revenir instantanément à la V1.
const USE_V2_SHELL = true;

const Root = USE_V2_SHELL ? AppV2 : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>
);
