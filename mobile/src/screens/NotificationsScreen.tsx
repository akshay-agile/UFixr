import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  created_at: string;
};

export default function NotificationsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiRequest<{ items: NotificationItem[] }>("/notifications", { token });
        setItems(response.items);
      } catch (error) {
        Alert.alert("Load failed", error instanceof Error ? error.message : "Unknown error");
      }
    };
    load();
  }, []);

  const todayItems = useMemo(() => items.slice(0, 3), [items]);
  const olderItems = useMemo(() => items.slice(3), [items]);

  const NotificationCard = ({ item, unread, index }: { item: NotificationItem; unread: boolean; index: number }) => {
    const icon = index % 3 === 0 ? "A" : index % 3 === 1 ? "!" : "W";
    const bg = index % 3 === 0 ? T.electricSoft : index % 3 === 1 ? T.criticalSoft : T.waterSoft;

    return (
      <View style={[styles.card, unread && styles.cardUnread]}>
        <View style={[styles.cardIcon, { backgroundColor: bg }]}>
          <Text style={{ fontSize: 16 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
        </View>
        {unread ? <View style={styles.dot} /> : null}
      </View>
    );
  };

  return (
    <Screen>
      <Text style={styles.title}>Alerts</Text>
      <Text style={styles.subtitle}>{todayItems.length} unread notifications</Text>

      <Text style={styles.groupLabel}>Today</Text>
      {todayItems.map((item, index) => (
        <NotificationCard key={item.id} item={item} unread index={index} />
      ))}

      {olderItems.length > 0 ? <Text style={styles.groupLabel}>Earlier</Text> : null}
      {olderItems.map((item, index) => (
        <NotificationCard key={item.id} item={item} unread={false} index={index + 3} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: T.ink,
    letterSpacing: -1,
    marginTop: 12,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: T.inkMuted,
    fontWeight: "300",
    marginBottom: 16,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: T.inkFaint,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: T.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.line,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: T.electric,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    fontSize: 13,
    color: T.ink,
    lineHeight: 19,
    marginBottom: 4,
  },
  time: {
    fontSize: 11,
    color: T.inkFaint,
    fontWeight: "300",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.electric,
    marginTop: 4,
  },
});


