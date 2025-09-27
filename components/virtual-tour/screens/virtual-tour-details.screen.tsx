import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useCreateVirtualTour from "../../../hooks/virtual-tour/create-virtual-tour.hook";
import { VirtualTourWithScene } from "../../../types/virtual-tour.type";

const VirtualTourDetailsScreen = () => {
  const params = useLocalSearchParams();
  console.log("params", params);
  const id = params.id as string;
  const router = useRouter();
  const { getVirtualTour } = useCreateVirtualTour();
  const [virtualTour, setVirtualTour] = useState<VirtualTourWithScene | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVirtualTour = async () => {
      try {
        if (id) {
          const tour = await getVirtualTour(id as string);
          setVirtualTour(tour);
        }
      } catch (error) {
        console.error("Error loading virtual tour:", error);
      } finally {
        setLoading(false);
      }
    };

    loadVirtualTour();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!virtualTour) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Project not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{virtualTour.name}</Text>

        {virtualTour.description && (
          <Text style={styles.description}>{virtualTour.description}</Text>
        )}

        <DetailsCard virtualTour={virtualTour} />

        {virtualTour.scenes && virtualTour.scenes.length > 0 && (
          <View style={styles.scenesContainer}>
            <Text style={styles.sectionTitle}>
              Scenes ({virtualTour.scenes.length})
            </Text>
            {virtualTour.scenes.map((scene, index) => (
              <View key={scene.id || index} style={styles.sceneItem}>
                <Image
                  source={{ uri: scene.image }}
                  style={styles.sceneImage}
                  resizeMode="cover"
                />
                <View style={styles.sceneInfo}>
                  <Text style={styles.sceneType}>{scene.scene}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <TouchableOpacity
        style={styles.newSceneButton}
        onPress={() => {
          router.push(`/new-scene/${virtualTour.id}` as any);
        }}
      >
        <Text style={styles.buttonText}>New Scene</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const DetailsCard = ({
  virtualTour,
}: {
  virtualTour: VirtualTourWithScene;
}) => {
  return (
    <View style={styles.detailsContainer}>
      <Text style={styles.sectionTitle}>Project Details</Text>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Created by:</Text>
        <Text style={styles.detailValue}>{virtualTour.createdBy}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Store ID:</Text>
        <Text style={styles.detailValue}>{virtualTour.storeId}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Employee ID:</Text>
        <Text style={styles.detailValue}>{virtualTour.employeeId}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Created:</Text>
        <Text style={styles.detailValue}>
          {virtualTour.created_at
            ? new Date(virtualTour.created_at).toLocaleDateString()
            : "Unknown"}
        </Text>
      </View>

      {virtualTour.coordinates && (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Location:</Text>
          <Text style={styles.detailValue}>
            {virtualTour.coordinates.latitude},{" "}
            {virtualTour.coordinates.longitude}
          </Text>
        </View>
      )}
    </View>
  );
};

export default VirtualTourDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: "#00674f",
    fontWeight: "500",
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#1f2937",
  },
  description: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 24,
    lineHeight: 24,
  },
  detailsContainer: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  detailValue: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  scenesContainer: {
    marginBottom: 24,
  },
  sceneItem: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
  },
  sceneImage: {
    width: 80,
    height: 60,
  },
  sceneInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  sceneType: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  button: {
    backgroundColor: "#00674f",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  newSceneButton: {
    backgroundColor: "#00674f",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",

    bottom: "8%",
    left: 16,
    right: 16,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
