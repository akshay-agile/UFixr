import React, { useMemo } from "react";
import MapView, { Circle, Heatmap, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { StyleSheet, View } from "react-native";

export type LiveClusterPoint = {
  id: number;
  latitude: number;
  longitude: number;
  radius_meters: number;
  utility_type: "electricity" | "water";
  priority_score?: number;
  estimated_people?: number;
  estimated_resolution_minutes?: number;
};

type LiveClusterMapProps = {
  clusters: LiveClusterPoint[];
  focusRegion?: Region;
};

const DEFAULT_REGION: Region = {
  latitude: 12.9716,
  longitude: 77.5946,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function LiveClusterMap({ clusters, focusRegion }: LiveClusterMapProps) {
  const heatmapPoints = useMemo(
    () =>
      clusters.flatMap((cluster) => {
        const weight = Math.max(1, (cluster.priority_score ?? 40) / 20);
        return [{ latitude: cluster.latitude, longitude: cluster.longitude, weight }];
      }),
    [clusters]
  );

  const regionProps = focusRegion ? { region: focusRegion } : { initialRegion: DEFAULT_REGION };

  return (
    <View style={styles.container}>
      <MapView provider={PROVIDER_GOOGLE} style={styles.map} {...regionProps}>
        {heatmapPoints.length > 0 ? (
          <Heatmap
            points={heatmapPoints}
            opacity={0.6}
            radius={40}
            gradient={{
              colors: ["rgba(255,255,255,0)", "#fde68a", "#f97316", "#dc2626"],
              startPoints: [0.1, 0.3, 0.6, 0.9],
              colorMapSize: 256,
            }}
          />
        ) : null}
        {clusters.map((cluster) => {
          const isWater = cluster.utility_type === "water";
          const strokeColor = isWater ? "rgba(59,130,246,0.8)" : "rgba(245,158,11,0.85)";
          const fillColor = isWater ? "rgba(59,130,246,0.18)" : "rgba(245,158,11,0.18)";
          return (
            <Circle
              key={cluster.id}
              center={{ latitude: cluster.latitude, longitude: cluster.longitude }}
              radius={Math.max(180, cluster.radius_meters)}
              strokeColor={strokeColor}
              fillColor={fillColor}
              strokeWidth={2}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
