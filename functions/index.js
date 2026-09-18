const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const METRICOOL_API_TOKEN = defineSecret("METRICOOL_API_TOKEN");
const METRICOOL_USER_ID = "3507262";
const METRICOOL_BRANDS = [
  { club: "Lyon", blogId: "4483840" },
  { club: "La Boisse", blogId: "4483916" },
  { club: "Mâcon", blogId: "5854454" },
];

const API_ROOT = "https://app.metricool.com/";
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const round = (value, digits = 2) => Number((Number(value || 0)).toFixed(digits));
const sum = (items, field) => items.reduce((total, item) => total + Number(item?.[field] || 0), 0);
const average = (items, field) => items.length ? sum(items, field) / items.length : 0;
const cleanForFirestore = value => JSON.parse(JSON.stringify(value));

function monthRange(date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const today = new Date();
  const isCurrent = year === today.getUTCFullYear() && month === today.getUTCMonth();
  const end = isCurrent
    ? new Date(Date.UTC(year, month, Math.max(1, today.getUTCDate() - 1), 23, 59, 59))
    : new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
  const baseline = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    from: start.toISOString().slice(0, 19),
    to: end.toISOString().slice(0, 19),
    baselineFrom: baseline.toISOString().slice(0, 19),
  };
}

async function metricoolGet(path, params, token) {
  const url = new URL(path, API_ROOT);
  Object.entries({ userId: METRICOOL_USER_ID, ...params }).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { "X-Mc-Auth": token, "Content-Type": "application/json", "X-MC-Isrc": "esprit-padel-reporting" },
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) return response.json();
    const body = await response.text();
    if (response.status < 500 || attempt === 3) {
      throw new Error(`Metricool ${path}: ${response.status} ${body}`);
    }
    await new Promise(resolve => setTimeout(resolve, attempt * 750));
  }
  return { data: [] };
}

async function metricoolGetOptional(path, params, token) {
  try {
    return await metricoolGet(path, params, token);
  } catch (error) {
    console.warn(`Donnée Metricool temporairement indisponible: ${error.message}`);
    return { data: [] };
  }
}

const approvalTaskId = task => String(task?.postUuid || task?.postId || task?.id || "");
const compactApprovalTask = task => ({
  id: approvalTaskId(task),
  postId: task?.postId || "",
  postUuid: task?.postUuid || "",
  blogId: String(task?.blogId || ""),
  club: task?.blogName || METRICOOL_BRANDS.find(brand => String(brand.blogId) === String(task?.blogId))?.club || "Club",
  text: String(task?.text || task?.content || "").slice(0, 1200),
  mediaUrl: task?.mediaUrl || task?.imageUrl || "",
  networks: Array.isArray(task?.networks) ? task.networks : [],
  status: task?.status || "pending",
  taskType: task?.taskType || "reviewer",
  publicationDate: task?.publicationDate || null,
  timezone: task?.timezone || "Europe/Paris",
  approvalTaskUsers: Array.isArray(task?.approvalTaskUsers) ? task.approvalTaskUsers : [],
});

async function syncMetricoolApprovals(db, token) {
  const raw = await metricoolGet(`api/v2/scheduler/tasks/${METRICOOL_USER_ID}`, {
    "editorStatus[]": "rejected",
    "reviewerStatus[]": "pending",
  }, token);
  const tasks = (Array.isArray(raw) ? raw : raw?.data || []).map(compactApprovalTask).filter(task => task.id);
  const ref = db.doc("appdata/ep:metricool-approvals");
  const snap = await ref.get();
  const previous = snap.data()?.value?.items || [];
  const previousIds = new Set(previous.map(approvalTaskId));
  const newTasks = tasks.filter(task => !previousIds.has(task.id));
  const value = { items: tasks, pendingCount: tasks.filter(task => task.status === "pending").length, syncedAt: Date.now(), ok: true };
  await ref.set({ value: cleanForFirestore(value), updatedAt: Date.now() });

  if (newTasks.length) {
    const users = (await db.doc("appdata/ep:users").get()).data()?.value || [];
    const admins = users.filter(user => normalize(user.role).includes("admin"));
    for (const admin of admins) {
      for (const task of newTasks) {
        await deliverTaskNotification(db, admin.id, {
          title: `Nouvelle publication à valider · ${task.club}`,
          description: task.text ? task.text.slice(0, 140) : "Une nouvelle soumission Metricool attend votre validation.",
          icon: "M",
          badges: [task.club, "Metricool", "En attente"],
          target: "metricool-approvals",
        }, `metricool-approval-${task.id}`);
      }
    }
  }
  return value;
}

const compactPost = post => ({
  id: post.postId,
  type: post.type,
  date: post.publishedAt?.dateTime || "",
  url: post.url || "",
  text: String(post.content || "").slice(0, 700),
  image: post.imageUrl || "",
  reach: Number(post.reach || 0),
  views: Number(post.views ?? post.impressionsTotal ?? post.impressions ?? 0),
  interactions: Number(post.interactions || 0),
  likes: Number(post.likes || 0),
  comments: Number(post.comments || 0),
  shares: Number(post.shares || 0),
  saved: Number(post.saved || 0),
  engagement: round(post.engagement),
  raw: cleanForFirestore(post),
});

const compactStory = story => ({
  id: story.postId,
  date: story.publishedAt?.dateTime || "",
  text: String(story.content || "").slice(0, 250),
  image: story.imageUrl || "",
  reach: Number(story.reach || 0),
  impressions: Number(story.impressions || story.views || 0),
  replies: Number(story.replies || 0),
  tapsBack: Number(story.tapsBack || 0),
  tapsForward: Number(story.tapsForward || 0),
  exits: Number(story.exits || 0),
  raw: cleanForFirestore(story),
});

async function fetchClubMonth(brand, range, token) {
  const common = { blogId: brand.blogId, from: range.from, to: range.to, timezone: "Europe/Paris" };
  const [postsRaw, reelsRaw, storiesRaw, hashtagsRaw, followersRaw, genderRaw, ageRaw, countryRaw, cityRaw] = await Promise.all([
    metricoolGet("api/v2/analytics/posts/instagram", common, token),
    metricoolGet("api/v2/analytics/reels/instagram", common, token),
    metricoolGetOptional("api/v2/analytics/stories/instagram", common, token),
    metricoolGetOptional("api/v2/analytics/posts/instagram/hashtags", common, token),
    metricoolGet("api/v2/analytics/timelines", { ...common, from: range.baselineFrom, metric: "followers", network: "instagram", subject: "account" }, token),
    metricoolGetOptional("api/v2/analytics/distribution", { ...common, metric: "gender", network: "instagram", subject: "account" }, token),
    metricoolGetOptional("api/v2/analytics/distribution", { ...common, metric: "age", network: "instagram", subject: "account" }, token),
    metricoolGetOptional("api/v2/analytics/distribution", { ...common, metric: "country", network: "instagram", subject: "account" }, token),
    metricoolGetOptional("api/v2/analytics/distribution", { ...common, metric: "city", network: "instagram", subject: "account" }, token),
  ]);

  const posts = (postsRaw.data || []).map(compactPost);
  const reels = (reelsRaw.data || []).map(compactPost);
  const stories = (storiesRaw.data || []).map(compactStory);
  const followerValues = (followersRaw.data?.[0]?.values || [])
    .map(item => ({ date: item.dateTime, value: Number(item.value || 0) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const firstFollowers = followerValues[0]?.value || 0;
  const followers = followerValues[followerValues.length - 1]?.value || firstFollowers;
  const followerChange = followers - firstFollowers;
  const allContent = [...posts, ...reels];
  const interactions = sum(allContent, "interactions");
  const reach = sum(allContent, "reach");

  const summary = {
    abonnes: followers,
    txEvol: firstFollowers ? round((followerChange / firstFollowers) * 100) : 0,
    evolutionAbonnes: followerChange,
    publications: posts.length,
    reels: reels.length,
    stories: stories.length,
    porteeMoy: round(average(posts, "reach")),
    porteeMoyReel: round(average(reels, "reach")),
    porteeMoyStory: round(average(stories, "reach")),
    interactions,
    porteeTotale: round(reach),
    engagement: reach ? round((interactions / reach) * 100) : 0,
    vues: sum(allContent, "views"),
    jaimes: sum(allContent, "likes"),
    commentaires: sum(allContent, "comments"),
    partages: sum(allContent, "shares"),
    enregistrements: sum(allContent, "saved"),
    storiesImpressions: sum(stories, "impressions"),
    source: "metricool",
    syncedAt: Date.now(),
  };

  const details = {
    source: "metricool",
    syncedAt: Date.now(),
    month: range.key,
    club: brand.club,
    summary,
    demographics: {
      gender: genderRaw.data || [], age: ageRaw.data || [],
      country: countryRaw.data || [], city: cityRaw.data || [],
    },
    followersTimeline: followerValues,
    rawFollowers: cleanForFirestore(followersRaw.data || []),
    posts,
    hashtags: hashtagsRaw.data || [],
    reels,
    stories,
  };
  return { summary, details };
}

async function syncMonth(db, range, token) {
  const clubsSnap = await db.doc("appdata/ep:clubs").get();
  const clubs = clubsSnap.data()?.value || [];
  const reportingRef = db.doc("appdata/ep:reporting");
  const reportingSnap = await reportingRef.get();
  const reporting = reportingSnap.data()?.value || {};
  const existing = reporting[range.key] || [];
  const updated = [...existing];

  for (const brand of METRICOOL_BRANDS) {
    const club = clubs.find(item => normalize(item.name) === normalize(brand.club));
    if (!club) throw new Error(`Club introuvable dans Firestore: ${brand.club}`);
    const { summary, details } = await fetchClubMonth(brand, range, token);
    const entry = { clubId: club.id, ...summary };
    const index = updated.findIndex(item => String(item.clubId) === String(club.id));
    if (index >= 0) updated[index] = entry; else updated.push(entry);
    await db.doc(`appdata/ep:reporting-details:${range.key}:${club.id}`).set({
      value: cleanForFirestore(details),
      updatedAt: Date.now(),
    });
  }

  reporting[range.key] = updated;
  await reportingRef.set({ value: cleanForFirestore(reporting), updatedAt: Date.now() });
  await db.doc("appdata/ep:metricool-sync-status").set({
    value: { ok: true, month: range.key, syncedAt: Date.now(), clubs: METRICOOL_BRANDS.map(item => item.club) },
    updatedAt: Date.now(),
  });
}

function objectiveRange(objective, now = new Date()) {
  const start = new Date(`${objective.startDate}T00:00:00Z`);
  const deadline = new Date(`${objective.deadline}T23:59:59Z`);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(23, 59, 59, 0);
  const effectiveEnd = yesterday < deadline ? yesterday : deadline;
  const baseline = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  return {
    key: `objective-${objective.id}`,
    from: start.toISOString().slice(0, 19),
    to: effectiveEnd.toISOString().slice(0, 19),
    baselineFrom: baseline.toISOString().slice(0, 19),
    days: Math.max(1, Math.floor((effectiveEnd - start) / 86400000) + 1),
    started: now >= start,
    expired: now > deadline,
  };
}

function objectiveMetric(summary, key, days) {
  const values = {
    abonnes: summary.abonnes,
    txEvol: summary.txEvol,
    nouveauxAbonnes: summary.evolutionAbonnes,
    porteeMoyJour: round(summary.porteeTotale / days),
    storiesParJour: round(summary.stories / days),
    postsTotal: summary.publications + summary.reels,
    publications: summary.publications, reels: summary.reels, stories: summary.stories,
    porteeMoy: summary.porteeMoy, porteeMoyReel: summary.porteeMoyReel, porteeMoyStory: summary.porteeMoyStory,
    interactions: summary.interactions, engagement: summary.engagement, vues: summary.vues,
    jaimes: summary.jaimes, commentaires: summary.commentaires, partages: summary.partages,
    enregistrements: summary.enregistrements,
  };
  return Number(values[key] || 0);
}

async function evaluateObjectives(db, token) {
  const objectivesRef = db.doc("appdata/ep:objectives");
  const objectivesSnap = await objectivesRef.get();
  const objectives = objectivesSnap.data()?.value || [];
  const now = new Date();
  const cache = new Map();
  let changed = false;
  const evaluated = [];

  for (const objective of objectives) {
    if (!objective.startDate || !objective.deadline || !objective.metricKey || objective.source !== "metricool") {
      evaluated.push(objective);
      continue;
    }
    const range = objectiveRange(objective, now);
    if (!range.started) {
      evaluated.push({ ...objective, status: "scheduled", progress: 0, current: 0, evaluationLabel: "À venir" });
      changed = true;
      continue;
    }
    const brand = METRICOOL_BRANDS.find(item => normalize(item.club) === normalize(objective.clubName || ""));
    let resolvedBrand = brand;
    if (!resolvedBrand) {
      const clubs = (await db.doc("appdata/ep:clubs").get()).data()?.value || [];
      const club = clubs.find(item => String(item.id) === String(objective.club));
      resolvedBrand = METRICOOL_BRANDS.find(item => normalize(item.club) === normalize(club?.name));
    }
    if (!resolvedBrand) { evaluated.push(objective); continue; }
    const cacheKey = `${resolvedBrand.blogId}:${range.from}:${range.to}`;
    if (!cache.has(cacheKey)) cache.set(cacheKey, fetchClubMonth(resolvedBrand, range, token));
    const { summary } = await cache.get(cacheKey);
    const current = objectiveMetric(summary, objective.metricKey, range.days);
    const baseline = objective.metricKey === "abonnes" ? Number(summary.abonnes || 0) - Number(summary.evolutionAbonnes || 0) : 0;
    const target = Number(objective.target || 0);
    const rawProgress = objective.metricKey === "abonnes" && target > baseline
      ? ((current - baseline) / (target - baseline)) * 100
      : target > 0 ? (current / target) * 100 : 0;
    const progress = Math.max(0, Math.min(100, round(rawProgress)));
    let status = range.expired ? (progress >= 100 ? "success" : progress >= 80 ? "almost_success" : "failed") : "active";
    evaluated.push({ ...objective, current, baseline, progress, status, evaluationLabel: status === "success" ? "Réussi" : status === "almost_success" ? "Presque réussi" : status === "failed" ? "Raté" : "En cours", metricPeriodFrom: objective.startDate, metricPeriodTo: range.to.slice(0, 10), evaluatedAt: Date.now() });
    changed = true;
  }
  if (changed) await objectivesRef.set({ value: cleanForFirestore(evaluated), updatedAt: Date.now() });
}

exports.metricoolSyncScheduled = onSchedule({
  schedule: "15 4 * * *",
  timeZone: "Europe/Paris",
  secrets: [METRICOOL_API_TOKEN],
  timeoutSeconds: 540,
  memory: "512MiB",
}, async () => {
  const db = getFirestore();
  const token = METRICOOL_API_TOKEN.value();
  const now = new Date();
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  try {
    await syncMonth(db, monthRange(previous), token);
    await syncMonth(db, monthRange(now), token);
    await evaluateObjectives(db, token);
    await syncMetricoolApprovals(db, token);
  } catch (error) {
    await db.doc("appdata/ep:metricool-sync-status").set({
      value: { ok: false, error: String(error.message || error).slice(0, 500), syncedAt: Date.now() },
      updatedAt: Date.now(),
    });
    throw error;
  }
});

exports.metricoolApprovalsScheduled = onSchedule({
  schedule: "every 5 minutes",
  timeZone: "Europe/Paris",
  secrets: [METRICOOL_API_TOKEN],
  timeoutSeconds: 120,
  memory: "256MiB",
}, async () => {
  const db = getFirestore();
  const token = METRICOOL_API_TOKEN.value();
  try {
    await syncMetricoolApprovals(db, token);
  } catch (error) {
    await db.doc("appdata/ep:metricool-approvals").set({
      value: { items: [], pendingCount: 0, syncedAt: Date.now(), ok: false, error: String(error.message || error).slice(0, 500) },
      updatedAt: Date.now(),
    }, { merge: true });
    throw error;
  }
});

async function deliverTaskNotification(db, userId, payload, dedupeKey) {
  const ref = db.doc(`appdata/ep:notifs_${userId}`);
  const snap = await ref.get();
  const existing = snap.data()?.value || [];
  if (existing.some(item => item.dedupeKey === dedupeKey)) return;
  const notification = {
    id: `scheduled-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...payload,
    dedupeKey,
    target: payload.target || "todo",
    timestamp: Date.now(),
    date: new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }),
  };
  await ref.set({ value: [notification, ...existing].slice(0, 100), updatedAt: Date.now() });
  const tokenSnap = await db.doc(`appdata/ep:fcmtokens_${userId}`).get();
  const tokens = tokenSnap.data()?.tokens || [];
  if (tokens.length) {
    try {
      await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.description || "Ouvrez l’application pour consulter le détail." },
        webpush: { fcmOptions: { link: `https://esprit-padel-communication.web.app/?page=${payload.target || "todo"}` } },
      });
    } catch (error) { console.warn("Push tâche non envoyé", userId, error.message); }
  }
}

exports.taskRemindersScheduled = onSchedule({
  schedule: "0 8 * * *",
  timeZone: "Europe/Paris",
  timeoutSeconds: 180,
}, async () => {
  const db = getFirestore();
  const tasks = (await db.doc("appdata/ep:tasks").get()).data()?.value || [];
  const now = new Date();
  const parisToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year:"numeric", month:"2-digit", day:"2-digit" }).format(now);
  const start = new Date(`${parisToday}T00:00:00Z`);
  for (const task of tasks) {
    if (!task.deadline || task.status === "Terminée") continue;
    const due = new Date(`${task.deadline}T00:00:00Z`);
    const diff = Math.round((due - start) / 86400000);
    if (![7, 3, 1, 0].includes(diff) && diff >= 0) continue;
    const label = diff < 0 ? `En retard de ${Math.abs(diff)} jour(s)` : diff === 0 ? "Échéance aujourd’hui" : `Échéance dans ${diff} jour(s)`;
    const targets = [...new Set((task.assignedTo || (task.assigneeId ? [task.assigneeId] : [])).map(String))];
    for (const userId of targets) await deliverTaskNotification(db, userId, {
      title: `${diff < 0 ? "🔴" : "⏰"} ${label} — ${task.title}`,
      description: task.description || "Une tâche nécessite votre attention.",
      icon: diff < 0 ? "🔴" : "⏰",
      badges: [label],
      type: diff < 0 ? "TASK_OVERDUE" : "TASK_REMINDER",
    }, `task-${task.id}-${parisToday}-${diff < 0 ? "late" : diff}`);
  }
});

exports.weeklyTaskSummaryScheduled = onSchedule({
  schedule: "0 9 * * 1",
  timeZone: "Europe/Paris",
  timeoutSeconds: 180,
}, async () => {
  const db = getFirestore();
  const [taskSnap, userSnap] = await Promise.all([db.doc("appdata/ep:tasks").get(), db.doc("appdata/ep:users").get()]);
  const tasks = taskSnap.data()?.value || [];
  const users = userSnap.data()?.value || [];
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
  for (const user of users.filter(item => item.admin || item.role === "Directeur")) {
    const clubIds = (user.clubs || []).map(String);
    const relevant = user.admin ? tasks : tasks.filter(task => (task.clubs || [task.club]).filter(Boolean).map(String).some(id => clubIds.includes(id)));
    const active = relevant.filter(task => task.status !== "Terminée");
    const late = active.filter(task => task.deadline && task.deadline < todayKey);
    const done = relevant.filter(task => task.status === "Terminée");
    await deliverTaskNotification(db, String(user.id), {
      title: `📊 Résumé hebdomadaire — ${active.length} tâche(s) active(s)`,
      description: `${done.length} terminée(s) · ${late.length} en retard.`,
      icon: "📊",
      badges: ["Résumé du lundi"],
      type: "WEEKLY_TASK_SUMMARY",
    }, `weekly-task-summary-${todayKey}`);
  }
});
