import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getLearningDatabase } from "./db";
import { useAuth } from "./Auth";
import { streakForDays } from "./learning";
export function useLearning() {
  const { learningScope } = useAuth();
  const db = getLearningDatabase();
  const activities = useLiveQuery(
    () => db.activities.toArray(),
    [learningScope],
    [],
  );
  const progress = useLiveQuery(
    () => db.progress.toArray(),
    [learningScope],
    [],
  );
  const cards = useLiveQuery(() => db.cards.toArray(), [learningScope], []);
  const favorites = useLiveQuery(
    () => db.favorites.toArray(),
    [learningScope],
    [],
  );
  const reviews = useLiveQuery(() => db.reviews.count(), [learningScope], 0);
  return {
    activities,
    progress,
    cards,
    favorites,
    reviews,
    xp: activities.reduce((n, a) => n + a.xp, 0),
    streak: streakForDays(activities.map((a) => a.day)),
    storiesRead: progress.filter((p) => p.completed).length,
  };
}
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
export function useNow() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  // A new card can arrive between ticks. Re-read the clock on that render so
  // vocabulary added now is immediately due instead of waiting 30 seconds.
  return Date.now();
}
