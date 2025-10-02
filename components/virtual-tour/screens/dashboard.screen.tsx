import { useAuth } from "@/contexts/AuthContext";
import { VirtualTourWithScene } from "@/types/virtual-tour.type";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useCreateVirtualTour from "../../../hooks/virtual-tour/create-virtual-tour.hook";
import ProjectList from "../project-list.component";

const DashboardScreen = () => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { getVirtualTours } = useCreateVirtualTour();
  const [virtualTours, setVirtualTours] = useState<VirtualTourWithScene[]>([]);
  const { logout } = useAuth();
  useFocusEffect(
    useCallback(() => {
      const fetchVirtualTours = async () => {
        const tours = await getVirtualTours();
        setVirtualTours(tours);
      };
      fetchVirtualTours();
    }, [])
  );

  const filteredVirtualTours = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return virtualTours;
    return virtualTours.filter((p) =>
      p.name.toLowerCase().includes(normalized)
    );
  }, [virtualTours, query]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard ({virtualTours?.length})</Text>

        <TouchableOpacity onPress={() => logout()}>
          <Text style={styles.title}>Logout</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        placeholder="Search projects"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <ProjectList
        items={filteredVirtualTours.map((tour) => ({
          id: tour.id.toString(),
          image: tour.scenes?.[0]?.image || "",
          title: tour.name,
          createdAt: tour.created_at || new Date(),
        }))}
        onProjectPress={(project) =>
          router.push(`/project-details/${project.id}` as any)
        }
      />
      <PlusIcon onPress={() => router.push("project-create" as any)} />
    </SafeAreaView>
  );
};

const PlusIcon = ({ onPress }: { onPress: () => void }) => {
  return (
    <TouchableOpacity
      style={styles.plusIconWrapper}
      accessibilityRole="button"
      accessibilityLabel="Create new project"
      // hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      onPress={onPress}
    >
      <LinearGradient
        colors={["#00b894", "#00674f"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.plusIcon}
      >
        <Text style={styles.plusIconText}>+</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    padding: 12,
    // marginTop: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  search: {
    // marginHorizontal: 12,
    // marginBottom: 8,
    paddingHorizontal: 12,
    // paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "white",
    marginBottom: 8,
  },
  plusIconWrapper: {
    marginVertical: 12,
    position: "absolute",

    bottom: "9%",
    right: "50%",
    // transform: [{ translateX: "50%" }],
  },
  plusIcon: {
    width: 42,
    height: 42,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    display: "flex",
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    // Android elevation
    elevation: 4,
  },
  plusIconText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "600",
  },
});

export default DashboardScreen;
