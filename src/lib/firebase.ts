// =================================================================
// 𝗩𝗘𝗥𝗖𝗘𝗟 𝗙𝗥𝗘𝗘 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗕𝗢𝗧 — FIREBASE ADMIN & FAST DURABLE STORAGE
// =================================================================

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { CONFIG, getTodayDateString } from './config';
import {
  UserRecord,
  ProjectRecord,
  AdminRecord,
  SystemLogRecord,
  UserStateRecord,
  UserWorkflowState,
} from '../types';

let db: Firestore | null = null;
let isInitialized = false;

export function getFirestoreDB(): Firestore | null {
  if (db) return db;

  const projectId = CONFIG.FIREBASE_PROJECT_ID;
  const clientEmail = CONFIG.FIREBASE_CLIENT_EMAIL;
  const privateKey = CONFIG.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    db = getFirestore();
    isInitialized = true;
    return db;
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    return null;
  }
}

// Ultra-fast L1 In-Memory cache for instant sub-millisecond bot response
const l1Cache = {
  users: new Map<number, UserRecord>(),
  projects: new Map<string, ProjectRecord>(),
  admins: new Map<number, AdminRecord>(),
  logs: [] as SystemLogRecord[],
  states: new Map<number, UserStateRecord>(),
  adminsLoaded: false,
};

// Initialize Super Admin in default storage
l1Cache.admins.set(CONFIG.SUPER_ADMIN_ID, {
  user_id: CONFIG.SUPER_ADMIN_ID,
  role: 'super_admin',
  created_at: Date.now(),
});

// Helper for non-blocking async Firestore execution
function firestoreAsync(fn: () => Promise<any>) {
  setImmediate(() => {
    fn().catch((err) => console.warn('[FIRESTORE BACKGROUND SYNC ERROR]:', err?.message || err));
  });
}

// ----------------- USER MANAGEMENT -----------------

export async function getOrCreateUser(
  telegramId: number,
  userData: {
    username?: string;
    first_name?: string;
    last_name?: string;
  }
): Promise<UserRecord> {
  const today = getTodayDateString();
  const cachedUser = l1Cache.users.get(telegramId);

  if (cachedUser) {
    let dailyUsage = cachedUser.daily_usage || 0;
    if (cachedUser.daily_usage_date !== today) {
      dailyUsage = 0;
    }

    cachedUser.username = userData.username || cachedUser.username || '';
    cachedUser.first_name = userData.first_name || cachedUser.first_name || '';
    cachedUser.last_name = userData.last_name || cachedUser.last_name || '';
    cachedUser.last_active = Date.now();
    cachedUser.daily_usage = dailyUsage;
    cachedUser.daily_usage_date = today;

    const db = getFirestoreDB();
    if (db) {
      firestoreAsync(async () => {
        await db.collection('users').doc(String(telegramId)).set(cachedUser, { merge: true });
      });
    }
    return cachedUser;
  }

  const db = getFirestoreDB();
  if (db) {
    const userRef = db.collection('users').doc(String(telegramId));
    const docSnap = await userRef.get();

    if (docSnap.exists) {
      const user = docSnap.data() as UserRecord;
      let dailyUsage = user.daily_usage || 0;
      if (user.daily_usage_date !== today) {
        dailyUsage = 0;
      }

      const updatedUser: UserRecord = {
        ...user,
        username: userData.username || user.username || '',
        first_name: userData.first_name || user.first_name || '',
        last_name: userData.last_name || user.last_name || '',
        last_active: Date.now(),
        daily_usage: dailyUsage,
        daily_usage_date: today,
      };

      l1Cache.users.set(telegramId, updatedUser);

      firestoreAsync(async () => {
        await userRef.set(updatedUser, { merge: true });
      });

      return updatedUser;
    } else {
      // New user
      const isSuperAdmin = telegramId === CONFIG.SUPER_ADMIN_ID;
      const newUser: UserRecord = {
        telegram_id: telegramId,
        username: userData.username || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        verified: false,
        banned: false,
        created_at: Date.now(),
        last_active: Date.now(),
        daily_usage: 0,
        daily_usage_date: today,
        role: isSuperAdmin ? 'super_admin' : 'user',
      };

      l1Cache.users.set(telegramId, newUser);

      firestoreAsync(async () => {
        await userRef.set(newUser);
      });

      return newUser;
    }
  }

  // Memory fallback
  const isSuperAdmin = telegramId === CONFIG.SUPER_ADMIN_ID;
  const fallbackUser: UserRecord = {
    telegram_id: telegramId,
    username: userData.username || '',
    first_name: userData.first_name || '',
    last_name: userData.last_name || '',
    verified: false,
    banned: false,
    created_at: Date.now(),
    last_active: Date.now(),
    daily_usage: 0,
    daily_usage_date: today,
    role: isSuperAdmin ? 'super_admin' : 'user',
  };
  l1Cache.users.set(telegramId, fallbackUser);
  return fallbackUser;
}

export async function getUser(telegramId: number): Promise<UserRecord | null> {
  const cached = l1Cache.users.get(telegramId);
  if (cached) return cached;

  const db = getFirestoreDB();
  if (db) {
    const docSnap = await db.collection('users').doc(String(telegramId)).get();
    if (docSnap.exists) {
      const user = docSnap.data() as UserRecord;
      l1Cache.users.set(telegramId, user);
      return user;
    }
    return null;
  }
  return null;
}

export async function setUserVerified(telegramId: number, verified: boolean): Promise<void> {
  const user = l1Cache.users.get(telegramId);
  if (user) user.verified = verified;

  const db = getFirestoreDB();
  if (db) {
    firestoreAsync(async () => {
      await db.collection('users').doc(String(telegramId)).set({ verified }, { merge: true });
    });
  }
}

export async function incrementUserUsage(telegramId: number): Promise<number> {
  const today = getTodayDateString();
  let user = l1Cache.users.get(telegramId);

  if (!user) {
    user = await getUser(telegramId) || {
      telegram_id: telegramId,
      username: '',
      first_name: '',
      last_name: '',
      verified: false,
      banned: false,
      created_at: Date.now(),
      last_active: Date.now(),
      daily_usage: 0,
      daily_usage_date: today,
      role: telegramId === CONFIG.SUPER_ADMIN_ID ? 'super_admin' : 'user',
    };
    l1Cache.users.set(telegramId, user);
  }

  let count = user.daily_usage_date === today ? (user.daily_usage || 0) + 1 : 1;
  user.daily_usage = count;
  user.daily_usage_date = today;
  user.last_active = Date.now();

  const db = getFirestoreDB();
  if (db) {
    firestoreAsync(async () => {
      await db.collection('users').doc(String(telegramId)).set(
        {
          daily_usage: count,
          daily_usage_date: today,
          last_active: Date.now(),
        },
        { merge: true }
      );
    });
  }

  return count;
}

export async function resetUserDailyLimit(telegramId: number): Promise<boolean> {
  const today = getTodayDateString();
  const user = l1Cache.users.get(telegramId);
  if (user) {
    user.daily_usage = 0;
    user.daily_usage_date = today;
  }

  const db = getFirestoreDB();
  if (db) {
    firestoreAsync(async () => {
      await db.collection('users').doc(String(telegramId)).set(
        {
          daily_usage: 0,
          daily_usage_date: today,
        },
        { merge: true }
      );
    });
  }
  return true;
}

export async function setUserBanStatus(telegramId: number, banned: boolean): Promise<boolean> {
  const user = l1Cache.users.get(telegramId);
  if (user) {
    user.banned = banned;
  }

  const db = getFirestoreDB();
  if (db) {
    firestoreAsync(async () => {
      await db.collection('users').doc(String(telegramId)).set({ banned }, { merge: true });
    });
  }
  return true;
}

// ----------------- USER WORKFLOW STATE (ULTRA-FAST) -----------------

export async function getUserState(telegramId: number): Promise<UserStateRecord> {
  const state = l1Cache.states.get(telegramId);
  if (state) return state;

  return {
    user_id: telegramId,
    state: 'IDLE',
    updated_at: Date.now(),
  };
}

export async function setUserState(
  telegramId: number,
  state: UserWorkflowState,
  tempData?: any
): Promise<void> {
  const stateRecord: UserStateRecord = {
    user_id: telegramId,
    state,
    temp_data: tempData || {},
    updated_at: Date.now(),
  };

  l1Cache.states.set(telegramId, stateRecord);

  const db = getFirestoreDB();
  if (db) {
    firestoreAsync(async () => {
      await db.collection('user_states').doc(String(telegramId)).set(stateRecord);
    });
  }
}

export async function clearUserState(telegramId: number): Promise<void> {
  await setUserState(telegramId, 'IDLE', {});
}

// ----------------- PROJECT MANAGEMENT -----------------

export async function saveProject(project: ProjectRecord): Promise<void> {
  l1Cache.projects.set(project.project_id, project);

  const db = getFirestoreDB();
  if (db) {
    firestoreAsync(async () => {
      await db.collection('projects').doc(project.project_id).set(project, { merge: true });
    });
  }
}

export async function getProject(projectId: string): Promise<ProjectRecord | null> {
  const cached = l1Cache.projects.get(projectId);
  if (cached) return cached;

  const db = getFirestoreDB();
  if (db) {
    const docSnap = await db.collection('projects').doc(projectId).get();
    if (docSnap.exists) {
      const proj = docSnap.data() as ProjectRecord;
      l1Cache.projects.set(projectId, proj);
      return proj;
    }
    return null;
  }
  return null;
}

export async function getUserProjects(userId: number): Promise<ProjectRecord[]> {
  // Check if we have projects in cache
  const cached = Array.from(l1Cache.projects.values())
    .filter((p) => p.user_id === userId)
    .sort((a, b) => b.created_at - a.created_at);

  const db = getFirestoreDB();
  if (db && cached.length === 0) {
    try {
      const snap = await db.collection('projects').where('user_id', '==', userId).get();
      const list: ProjectRecord[] = [];
      snap.forEach((doc) => {
        const p = doc.data() as ProjectRecord;
        list.push(p);
        l1Cache.projects.set(p.project_id, p);
      });
      return list.sort((a, b) => b.created_at - a.created_at);
    } catch (e) {
      console.warn('Error fetching user projects from Firestore:', e);
    }
  }

  return cached;
}

export async function getAllProjects(): Promise<ProjectRecord[]> {
  const db = getFirestoreDB();
  if (db) {
    try {
      const snap = await db.collection('projects').get();
      const list: ProjectRecord[] = [];
      snap.forEach((doc) => {
        const p = doc.data() as ProjectRecord;
        list.push(p);
        l1Cache.projects.set(p.project_id, p);
      });
      return list.sort((a, b) => b.created_at - a.created_at);
    } catch (e) {
      console.warn('Error getting all projects from Firestore:', e);
    }
  }

  return Array.from(l1Cache.projects.values()).sort((a, b) => b.created_at - a.created_at);
}

export async function checkProjectNameExists(projectName: string, userId: number): Promise<boolean> {
  const existsInCache = Array.from(l1Cache.projects.values()).some(
    (p) => p.user_id === userId && p.project_name.toLowerCase() === projectName.toLowerCase()
  );
  if (existsInCache) return true;

  const db = getFirestoreDB();
  if (db) {
    const snap = await db
      .collection('projects')
      .where('user_id', '==', userId)
      .where('project_name', '==', projectName.toLowerCase())
      .get();
    return !snap.empty;
  }

  return false;
}

export async function deleteProjectRecord(projectId: string): Promise<void> {
  l1Cache.projects.delete(projectId);

  const db = getFirestoreDB();
  if (db) {
    firestoreAsync(async () => {
      await db.collection('projects').doc(projectId).delete();
    });
  }
}

// ----------------- ADMINS & ROLES -----------------

export async function isAdmin(telegramId: number): Promise<boolean> {
  if (telegramId === CONFIG.SUPER_ADMIN_ID) return true;
  if (l1Cache.admins.has(telegramId)) return true;

  const db = getFirestoreDB();
  if (db && !l1Cache.adminsLoaded) {
    const docSnap = await db.collection('admins').doc(String(telegramId)).get();
    if (docSnap.exists) {
      l1Cache.admins.set(telegramId, docSnap.data() as AdminRecord);
      return true;
    }
  }

  return false;
}

export async function isSuperAdmin(telegramId: number): Promise<boolean> {
  if (telegramId === CONFIG.SUPER_ADMIN_ID) return true;
  const record = l1Cache.admins.get(telegramId);
  return record?.role === 'super_admin';
}

export async function addAdmin(
  targetId: number,
  addedBy: number,
  username?: string
): Promise<boolean> {
  const record: AdminRecord = {
    user_id: targetId,
    role: 'admin',
    username: username || '',
    added_by: addedBy,
    created_at: Date.now(),
  };

  l1Cache.admins.set(targetId, record);

  const db = getFirestoreDB();
  if (db) {
    firestoreAsync(async () => {
      await db.collection('admins').doc(String(targetId)).set(record);
    });
  }
  return true;
}

export async function removeAdmin(targetId: number): Promise<boolean> {
  if (targetId === CONFIG.SUPER_ADMIN_ID) {
    return false; // Super admin cannot be removed
  }

  l1Cache.admins.delete(targetId);

  const db = getFirestoreDB();
  if (db) {
    firestoreAsync(async () => {
      await db.collection('admins').doc(String(targetId)).delete();
    });
  }
  return true;
}

export async function getAllAdmins(): Promise<AdminRecord[]> {
  const db = getFirestoreDB();
  if (db) {
    try {
      const snap = await db.collection('admins').get();
      snap.forEach((doc) => {
        const admin = doc.data() as AdminRecord;
        l1Cache.admins.set(admin.user_id, admin);
      });
      l1Cache.adminsLoaded = true;
    } catch (e) {
      console.warn('Error loading admins from Firestore:', e);
    }
  }

  return Array.from(l1Cache.admins.values());
}

// ----------------- SYSTEM LOGS & STATS -----------------

export async function logSystemAction(
  userId: number,
  action: string,
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'INFO',
  projectId?: string,
  details?: string
): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const record: SystemLogRecord = {
    log_id: logId,
    user_id: userId,
    action,
    status,
    project_id: projectId,
    details: details?.slice(0, 300),
    timestamp: Date.now(),
  };

  l1Cache.logs.unshift(record);
  if (l1Cache.logs.length > 500) {
    l1Cache.logs.pop();
  }

  const db = getFirestoreDB();
  if (db) {
    firestoreAsync(async () => {
      await db.collection('logs').doc(logId).set(record);
    });
  }
}

export async function getSystemStats(): Promise<{
  totalUsers: number;
  totalProjects: number;
  activeProjects: number;
  todayDeployments: number;
  bannedUsers: number;
  firebaseConnected: boolean;
}> {
  const db = getFirestoreDB();
  const today = getTodayDateString();

  if (db) {
    try {
      const [usersSnap, projectsSnap, bannedSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('projects').get(),
        db.collection('users').where('banned', '==', true).get(),
      ]);

      let todayCount = 0;
      usersSnap.forEach((doc) => {
        const u = doc.data() as UserRecord;
        l1Cache.users.set(u.telegram_id, u);
        if (u.daily_usage_date === today) {
          todayCount += u.daily_usage || 0;
        }
      });

      let activeCount = 0;
      projectsSnap.forEach((doc) => {
        const p = doc.data() as ProjectRecord;
        l1Cache.projects.set(p.project_id, p);
        if (p.status === 'ONLINE') activeCount++;
      });

      return {
        totalUsers: usersSnap.size,
        totalProjects: projectsSnap.size,
        activeProjects: activeCount,
        todayDeployments: todayCount,
        bannedUsers: bannedSnap.size,
        firebaseConnected: true,
      };
    } catch (e) {
      console.error('Failed to get stats from Firebase:', e);
    }
  }

  const users = Array.from(l1Cache.users.values());
  const projects = Array.from(l1Cache.projects.values());
  const todayDeployments = users.reduce((acc, u) => {
    return acc + (u.daily_usage_date === today ? u.daily_usage || 0 : 0);
  }, 0);

  return {
    totalUsers: users.length,
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'ONLINE').length,
    todayDeployments,
    bannedUsers: users.filter((u) => u.banned).length,
    firebaseConnected: false,
  };
}

export async function getAllUsers(): Promise<UserRecord[]> {
  const db = getFirestoreDB();
  if (db) {
    const snap = await db.collection('users').get();
    const list: UserRecord[] = [];
    snap.forEach((doc) => {
      const u = doc.data() as UserRecord;
      list.push(u);
      l1Cache.users.set(u.telegram_id, u);
    });
    return list.sort((a, b) => b.last_active - a.last_active);
  }

  return Array.from(l1Cache.users.values()).sort((a, b) => b.last_active - a.last_active);
}

export async function getRecentLogs(limit = 20): Promise<SystemLogRecord[]> {
  const db = getFirestoreDB();
  if (db) {
    try {
      const snap = await db.collection('logs').orderBy('timestamp', 'desc').limit(limit).get();
      const list: SystemLogRecord[] = [];
      snap.forEach((doc) => list.push(doc.data() as SystemLogRecord));
      return list;
    } catch (e) {
      console.warn('Failed to load recent logs from Firestore:', e);
    }
  }

  return l1Cache.logs.slice(0, limit);
}

