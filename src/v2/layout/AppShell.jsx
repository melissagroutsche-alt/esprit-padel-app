import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import {
  IconDashboard, IconInbox, IconLayers, IconCheckSquare, IconMail,
} from "../icons";

/* ── Mobile bottom nav — 5 prioritary entries ── */
const MOBILE_NAV = [
  { id: "dashboard",  label: "Accueil",  Icon: IconDashboard },
  { id: "demandes",   label: "Demandes", Icon: IconInbox },
  { id: "contenus",   label: "Contenus", Icon: IconLayers },
  { id: "projets",    label: "Tâches",   Icon: IconCheckSquare },
  { id: "mail",       label: "Mail",     Icon: IconMail },
];

export default function AppShell({ currentPage, onNavigate, children, badges = {}, currentUser }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="v2-shell">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        badges={badges}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentUser={currentUser}
      />

      <div className="v2-main">
        <Topbar
          currentPage={currentPage}
          onMenuOpen={() => setSidebarOpen(true)}
          notifCount={(badges.demandes || 0) + (badges.mail || 0)}
          onNavigate={onNavigate}
        />
        <main className="v2-content" id="v2-main-content" role="main">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="v2-mobile-nav" aria-label="Navigation mobile">
        {MOBILE_NAV.map((item) => {
          const count = badges[item.id === "demandes" ? "demandes" : item.id === "mail" ? "mail" : ""] || 0;
          return (
            <button
              key={item.id}
              className={`v2-mobile-nav__item${currentPage === item.id ? " active" : ""}`}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={currentPage === item.id ? "page" : undefined}
            >
              <item.Icon size={21} />
              <span>{item.label}</span>
              {count > 0 && (
                <span className="v2-mobile-nav__badge">{count}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
