import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, addDoc, Timestamp, orderBy, arrayUnion, arrayRemove, increment } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBirhBQ-VQFaAUAFnYjzm2UDPer2xlf3Eo",
  authDomain: "health-connect-1171f.firebaseapp.com",
  projectId: "health-connect-1171f",
  storageBucket: "health-connect-1171f.firebasestorage.app",
  messagingSenderId: "1012336958631",
  appId: "1:1012336958631:web:41748c96e2f097546f4f82",
  measurementId: "G-W9CVLC7VN0",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/**
 * Fetch user data from Firestore
 * @param {string} userId - The UID of the user
 * @returns {Promise<Object|null>} User data or null if not found
 */
export const getUserData = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() };
    } else {
      console.warn(`User not found: ${userId}`);
      return null;
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
};

/**
 * Fetch medicines for a specific member
 * @param {string} memberId - The member ID
 * @returns {Promise<Array>} Array of medicine objects
 */
export const getMedicines = async (memberId) => {
  try {
    const medicinesRef = collection(db, "medicines");
    const q = query(
      medicinesRef, 
      where("memberId", "==", memberId),
      where("isActive", "==", true)
    );
    const snapshot = await getDocs(q);
    
    const medicines = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return medicines;
  } catch (error) {
    console.error("Error fetching medicines:", error);
    throw error;
  }
};

/**
 * Fetch medication logs for calculating adherence
 * @param {string} memberId - The member ID
 * @returns {Promise<Array>} Array of medication log objects
 */
export const getMedicationLogs = async (memberId) => {
  try {
    const logsRef = collection(db, "medication_logs");
    // Get all logs for medicines belonging to this member
    const medicinesSnapshot = await getMedicines(memberId);
    const medicineIds = medicinesSnapshot.map(med => med.medicineId).filter(Boolean);
    
    if (medicineIds.length === 0) {
      return [];
    }
    
    // Firestore 'in' query supports max 10 items, so batch if needed
    const batches = [];
    for (let i = 0; i < medicineIds.length; i += 10) {
      const batch = medicineIds.slice(i, i + 10);
      const q = query(
        logsRef,
        where("medicineId", "in", batch)
      );
      batches.push(getDocs(q));
    }
    
    const snapshots = await Promise.all(batches);
    const logs = snapshots.flatMap(snapshot => 
      snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
    );
    
    return logs;
  } catch (error) {
    console.error("Error fetching medication logs:", error);
    throw error;
  }
};

/**
 * Calculate adherence percentage from medication logs
 * @param {Array} logs - Array of medication log objects
 * @returns {string} Adherence percentage (e.g., "85%")
 */
export const calculateAdherence = (logs) => {
  if (!logs || logs.length === 0) return "0%";
  
  const takenCount = logs.filter(log => log.status === "taken").length;
  const totalCount = logs.length;
  const adherence = Math.round((takenCount / totalCount) * 100);
  
  return `${adherence}%`;
};

/**
 * Log a medicine action (taken / skipped / missed) for today.
 * Uses a deterministic doc ID so duplicate calls just overwrite.
 * @param {string} memberId
 * @param {Object} med - { medicineId, name, dosage, scheduledTime }
 * @param {string} status - "taken" | "skipped" | "missed"
 */
export const logMedicineAction = async (memberId, med, status) => {
  try {
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const docId = `${memberId}_${med.medicineId}_${med.scheduledTime?.replace(/[\s:]/g, "")}_${today}`;
    const logRef = doc(db, "medication_logs", docId);
    await setDoc(logRef, {
      memberId,
      medicineId: med.medicineId,
      name: med.name,
      dosage: med.dosage,
      scheduledTime: med.scheduledTime,
      status,
      date: today,
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error logging medicine action:", error);
    throw error;
  }
};

/**
 * Get today's medication logs for a member.
 * Returns a map of  "medicineId_scheduledTime" → status
 * so the UI can restore taken/skipped states after refresh.
 * @param {string} memberId
 * @returns {Promise<Object>} e.g. { "abc123_0800AM": "taken", ... }
 */
export const getTodayMedicationLogs = async (memberId) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const logsRef = collection(db, "medication_logs");
    const q = query(
      logsRef,
      where("memberId", "==", memberId),
      where("date", "==", today)
    );
    const snapshot = await getDocs(q);
    const statusMap = {};
    snapshot.docs.forEach((d) => {
      const data = d.data();
      const key = `${data.medicineId}_${data.scheduledTime?.replace(/[\s:]/g, "")}`;
      statusMap[key] = data.status;
    });
    return statusMap;
  } catch (error) {
    console.error("Error fetching today's logs:", error);
    return {};
  }
};

/**
 * Save a medicine to the medicines collection
 * @param {Object} med - Medicine object from AI analysis
 * @param {string} memberId - The member/user ID
 * @param {string} visitId - The visit ID (shared per upload session)
 * @returns {Promise<string>} Document ID of the saved medicine
 */
export const saveMedicine = async (med, memberId, visitId) => {
  try {
    const medicineId = crypto.randomUUID();
    const medicinesRef = collection(db, "medicines");

    await addDoc(medicinesRef, {
      createdAt: Timestamp.now(),
      dosage: med.dosage || "",
      frequency: med.frequency || "once",
      isActive: true,
      medicineId,
      memberId,
      name: med.name || "",
      note: med.note || "",
      numberOfDays: Number(med.numberOfDays) || 7,
      scheduledTimes: med.scheduledTimes || { morning: "08:00" },
      timing: Array.isArray(med.timing) ? med.timing : ["morning"],
      visitId,
    });

    return medicineId;
  } catch (error) {
    console.error("Error saving medicine:", error);
    throw error;
  }
};

/* ══════════════════════════════════════════
   Community – Posts & Comments
   ══════════════════════════════════════════ */

/** Fetch all community posts, newest first */
export const getCommunityPosts = async () => {
  try {
    const postsRef = collection(db, "community_posts");
    const q = query(postsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ?? null,
      };
    });
  } catch (error) {
    console.error("Error fetching community posts:", error);
    throw error;
  }
};

/** Create a new community post */
export const createCommunityPost = async (post) => {
  try {
    const postId = crypto.randomUUID();
    const postRef = doc(db, "community_posts", postId);
    await setDoc(postRef, {
      postId,
      authorId: post.authorId,
      authorName: post.authorName,
      title: post.title || "",
      body: post.body || "",
      imageUrl: post.imageUrl || null,
      isAnonymous: post.isAnonymous || false,
      groupId: post.groupId || null,
      likedBy: [],
      commentCount: 0,
      createdAt: Timestamp.now(),
    });
    return postId;
  } catch (error) {
    console.error("Error creating post:", error);
    throw error;
  }
};

/** Toggle like on a post */
export const togglePostLike = async (postId, userId) => {
  try {
    const postRef = doc(db, "community_posts", postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    const likedBy = postSnap.data().likedBy || [];
    if (likedBy.includes(userId)) {
      await updateDoc(postRef, { likedBy: arrayRemove(userId) });
    } else {
      await updateDoc(postRef, { likedBy: arrayUnion(userId) });
    }
  } catch (error) {
    console.error("Error toggling post like:", error);
    throw error;
  }
};

/** Delete a post and its comments subcollection */
export const deleteCommunityPost = async (postId) => {
  try {
    // Delete all comments first
    const commentsRef = collection(db, "community_posts", postId, "comments");
    const snap = await getDocs(commentsRef);
    const deletes = snap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletes);
    // Delete the post
    await deleteDoc(doc(db, "community_posts", postId));
  } catch (error) {
    console.error("Error deleting post:", error);
    throw error;
  }
};

/** Fetch comments for a post */
export const getPostComments = async (postId) => {
  try {
    const commentsRef = collection(db, "community_posts", postId, "comments");
    const q = query(commentsRef, orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ?? null,
      };
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    throw error;
  }
};

/** Add a comment to a post */
export const addComment = async (postId, comment) => {
  try {
    const commentId = crypto.randomUUID();
    const commentRef = doc(db, "community_posts", postId, "comments", commentId);
    await setDoc(commentRef, {
      commentId,
      postId,
      authorId: comment.authorId,
      authorName: comment.authorName,
      body: comment.body,
      isAnonymous: comment.isAnonymous || false,
      likedBy: [],
      createdAt: Timestamp.now(),
    });
    // Increment commentCount on the post
    const postRef = doc(db, "community_posts", postId);
    await updateDoc(postRef, { commentCount: increment(1) });
    return commentId;
  } catch (error) {
    console.error("Error adding comment:", error);
    throw error;
  }
};

/** Toggle like on a comment */
export const toggleCommentLike = async (postId, commentId, userId) => {
  try {
    const commentRef = doc(db, "community_posts", postId, "comments", commentId);
    const commentSnap = await getDoc(commentRef);
    if (!commentSnap.exists()) return;
    const likedBy = commentSnap.data().likedBy || [];
    if (likedBy.includes(userId)) {
      await updateDoc(commentRef, { likedBy: arrayRemove(userId) });
    } else {
      await updateDoc(commentRef, { likedBy: arrayUnion(userId) });
    }
  } catch (error) {
    console.error("Error toggling comment like:", error);
    throw error;
  }
};

/* ══════════════════════════════════════════
   Diet Plan
   ══════════════════════════════════════════ */

/**
 * Fetch the saved diet plan for a user
 * @param {string} userId - The user/member ID
 * @returns {Promise<Object|null>} Diet plan data or null
 */
export const getDietPlan = async (userId) => {
  try {
    const dietRef = doc(db, "Diet Plan", userId);
    const dietSnap = await getDoc(dietRef);
    if (dietSnap.exists()) {
      return dietSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching diet plan:", error);
    throw error;
  }
};

/**
 * Save a diet plan for a user (overwrites previous plan)
 * @param {string} userId - The user/member ID
 * @param {Object} plan - The diet plan object from Gemini
 * @returns {Promise<void>}
 */
export const saveDietPlan = async (userId, plan) => {
  try {
    const dietRef = doc(db, "Diet Plan", userId);
    await setDoc(dietRef, {
      ...plan,
      userId,
      generatedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error saving diet plan:", error);
    throw error;
  }
};
