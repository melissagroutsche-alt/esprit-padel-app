import React from "react";
import {
  IconDashboard, IconTarget, IconInbox, IconMegaphone,
  IconCalendar, IconLayers, IconCheckSquare, IconMail,
  IconEvent, IconBarChart, IconPalette, IconUsers,
  IconFolder, IconBook, IconSettings, IconX, IconLogOut, IconUser,
} from "../icons";
import { useAuth } from "../../auth/AuthContext";
import { logoutUser } from "../../auth/authService";

const NAV = [
  {
    items: [
      { id: "dashboard",    label: "Dashboard",        Icon: IconDashboard },
      { id: "objectifs",    label: "Objectifs",        Icon: IconTarget },
      { id: "demandes",     label: "Demandes clubs",   Icon: IconInbox,      badgeKey: "demandes" },
      { id: "campagnes",    label: "Campagnes",        Icon: IconMegaphone },
      { id: "calendrier",   label: "Calendrier",       Icon: IconCalendar },
      { id: "contenus",     label: "Contenus",         Icon: IconLayers },
      { id: "projets",      label: "Projets & Tâches", Icon: IconCheckSquare },
    ],
  },
  {
    section: "Communication",
    items: [
      { id: "mail",         label: "Boîte mail",       Icon: IconMail,       badgeKey: "mail" },
      { id: "evenements",   label: "Événements",       Icon: IconEvent },
      { id: "kpi",          label: "KPI & Reporting",  Icon: IconBarChart },
    ],
  },
  {
    section: "Ressources",
    items: [
      { id: "brand",        label: "Brand Center",     Icon: IconPalette },
      { id: "equipe",       label: "Équipe",           Icon: IconUsers },
      { id: "ressources",   label: "Ressources",       Icon: IconFolder },
      { id: "formation",    label: "Formation",        Icon: IconBook },
    ],
  },
];

const ADMIN_ITEMS = [
  { id: "parametres", label: "Paramètres", Icon: IconSettings },
];

export default function Sidebar({ currentPage, onNavigate, badges = {}, isOpen, onClose, currentUser }) {
  const { firebaseUser } = useAuth();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "superAdmin";
  const displayName = currentUser?.name || firebaseUser?.displayName || firebaseUser?.email?.split("@")[0] || "Utilisateur";
  const roleLabel = currentUser?.role || "";

  function initials(name) {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }

  async function handleLogout() {
    try { await logoutUser(); } catch {}
  }

  return (
    <>
      {/* Overlay mobile */}
      <div
        className={`v2-sidebar-overlay${isOpen ? " visible" : ""}`}
        style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "all" : "none", transition: "opacity .22s" }}
        onClick={onClose}
      />

      <nav className={`v2-sidebar${isOpen ? " open" : ""}`} aria-label="Navigation principale">
        {/* Brand */}
        <div className="v2-sidebar__brand">
          <div className="v2-sidebar__logo">
            <div className="v2-sidebar__logo-mark">
              <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 11L5.5 3L9 11" stroke="#1a1a1c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3.5 8h4" stroke="#1a1a1c" strokeWidth="1.6" strokeLinecap="round"/>
                <circle cx="11" cy="9" r="2" fill="#1a1a1c"/>
              </svg>
            </div>
            <div className="v2-sidebar__logo-text">
              <span className="v2-sidebar__logo-name">Esprit Padel</span>
              <span className="v2-sidebar__logo-tagline">Communication OS</span>
            </div>
            {/* Close on mobile */}
            <button
              onClick={onClose}
              className="v2-btn v2-btn--icon"
              style={{ color: "rgba(255,255,255,.4)", marginLeft: "auto", display: "none" }}
              aria-label="Fermer la navigation"
            >
              <IconX />
            </button>
          </div>
        </div>

        {/* Nav */}
        <div className="v2-sidebar__nav">
          {NAV.map((group, gi) => (
            <div key={gi}>
              {group.section && (
                <div className="v2-sidebar__section">{group.section}</div>
              )}
              {group.items.map((item) => {
                const count = badges[item.badgeKey] || 0;
                return (
                  <button
                    key={item.id}
                    className={`v2-nav-item${currentPage === item.id ? " active" : ""}`}
                    onClick={() => { onNavigate(item.id); onClose(); }}
                    aria-current={currentPage === item.id ? "page" : undefined}
                  >
                    <span className="v2-nav-item__icon">
                      <item.Icon size={16} />
                    </span>
                    <span className="v2-nav-item__label">{item.label}</span>
                    {count > 0 && (
                      <span className="v2-nav-item__badge">{count > 99 ? "99+" : count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Admin section */}
          {isAdmin && (
            <div>
              <div className="v2-sidebar__section">Admin</div>
              {ADMIN_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className={`v2-nav-item${currentPage === item.id ? " active" : ""}`}
                  onClick={() => { onNavigate(item.id); onClose(); }}
                >
                  <span className="v2-nav-item__icon"><item.Icon size={16} /></span>
                  <span className="v2-nav-item__label">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer user */}
        <div className="v2-sidebar__footer">
          <div className="v2-sidebar__user" onClick={() => { onNavigate("profil"); onClose(); }}>
            <span
              className="v2-avatar v2-avatar--sm v2-avatar--orange"
              aria-hidden="true"
            >
              {initials(displayName)}
            </span>
            <div className="v2-sidebar__user-info">
              <div className="v2-sidebar__user-name">{displayName}</div>
              {roleLabel && <div className="v2-sidebar__user-role">{roleLabel}</div>}
            </div>
            <button
              className="v2-btn v2-btn--icon"
              style={{ color: "rgba(255,255,255,.3)", flexShrink: 0 }}
              onClick={(e) => { e.stopPropagation(); handleLogout(); }}
              title="Déconnexion"
              aria-label="Se déconnecter"
            >
              <IconLogOut size={14} />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
