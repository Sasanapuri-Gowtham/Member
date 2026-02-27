import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

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
