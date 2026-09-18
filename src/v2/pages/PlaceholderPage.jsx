import React from "react";
import {
  IconTarget, IconInbox, IconMegaphone, IconCalendar,
  IconLayers, IconCheckSquare, IconMail, IconEvent,
  IconBarChart, IconPalette, IconUsers, IconFolder, IconBook, IconSettings,
} from "../icons";

const PAGE_ICONS = {
  objectifs:  IconTarget,
  demandes:   IconInbox,
  campagnes:  IconMegaphone,
  calendrier: IconCalendar,
  contenus:   IconLayers,
  projets:    IconCheckSquare,
  mail:       IconMail,
  evenements: IconEvent,
  kpi:        IconBarChart,
  brand:      IconPalette,
  equipe:     IconUsers,
  ressources: IconFolder,
  formation:  IconBook,
  parametres: IconSettings,
};

const PAGE_SUBTITLES = {
  objectifs:  "Définissez et suivez vos objectifs stratégiques.",
  demandes:   "Recevez et traitez les demandes des clubs.",
  campagnes:  "Planifiez et pilotez vos campagnes de communication.",
  calendrier: "Visualisez tous vos contenus, événements et réunions.",
  contenus:   "Cockpit éditorial — créez, programmez et validez vos contenus.",
  projets:    "Gérez vos tâches et projets depuis un seul endroit.",
  mail:       "Boîte mail partagée — connectez-la à vos demandes et campagnes.",
  evenements: "Gérez événements et tournois Esprit Padel.",
  kpi:        "Tableaux de bord KPI et reporting de performance.",
  brand:      "Charte graphique, assets et templates de la marque.",
  equipe:     "Membres, rôles et plannings de l'équipe.",
  ressources: "Documents, supports et fichiers partagés.",
  formation:  "Contenus de formation et onboarding.",
  parametres: "Configuration de l'application et des accès.",
};

export default function PlaceholderPage({ pageId, title }) {
  const Icon = PAGE_ICONS[pageId];
  const subtitle = PAGE_SUBTITLES[pageId] || "Module en cours de développement.";

  return (
    <div className="v2-placeholder">
      <div className="v2-placeholder__card">
        {Icon && (
          <div className="v2-placeholder__icon">
            <Icon size={40} />
          </div>
        )}
        <div className="v2-placeholder__title">{title}</div>
        <div className="v2-placeholder__sub">{subtitle}</div>
        <div className="v2-placeholder__badge">
          <span className="v2-badge v2-badge--blue">Module V2 — À venir</span>
        </div>
      </div>
    </div>
  );
}
