import React, { useState } from "react";
import { IconSearch, IconBell, IconMenu, IconMetricool } from "../icons";

const PAGE_TITLES = {
  dashboard:   "Dashboard",
  objectifs:   "Objectifs",
  demandes:    "Demandes clubs",
  campagnes:   "Campagnes",
  calendrier:  "Calendrier",
  contenus:    "Contenus",
  projets:     "Projets & Tâches",
  mail:        "Boîte mail",
  evenements:  "Événements",
  kpi:         "KPI & Reporting",
  brand:       "Brand Center",
  equipe:      "Équipe",
  ressources:  "Ressources",
  formation:   "Formation",
  parametres:  "Paramètres",
  profil:      "Mon profil",
};

export default function Topbar({ currentPage, onMenuOpen, notifCount = 0, onNavigate }) {
  const [searchValue, setSearchValue] = useState("");
  const title = PAGE_TITLES[currentPage] || "—";

  return (
    <header className="v2-topbar" role="banner">
      {/* Hamburger mobile */}
      <button
        className="v2-topbar__hamburger v2-btn v2-btn--icon"
        onClick={onMenuOpen}
        aria-label="Ouvrir la navigation"
      >
        <IconMenu size={20} />
      </button>

      {/* Page title */}
      <h1 className="v2-topbar__title">{title}</h1>

      {/* Global search */}
      <div className="v2-topbar__search">
        <div className="v2-search">
          <IconSearch className="v2-search__icon" />
          <input
            className="v2-search__input"
            placeholder="Rechercher…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Recherche globale"
          />
        </div>
      </div>

      <div className="v2-topbar__spacer" />

      <div className="v2-topbar__actions">
        {/* Metricool external link */}
        <a
          href="https://app.metricool.com"
          target="_blank"
          rel="noopener noreferrer"
          className="v2-topbar__btn"
          title="Ouvrir Metricool"
          aria-label="Ouvrir Metricool"
        >
          <IconMetricool size={17} />
        </a>

        {/* Notifications */}
        <button
          className="v2-topbar__btn"
          aria-label={`Notifications${notifCount > 0 ? ` (${notifCount})` : ""}`}
        >
          <IconBell size={17} />
          {notifCount > 0 && <span className="v2-topbar__notif-dot" aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
