import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ProjectList, { ProjectListItem } from "./project-list.component";

type DashboardScreenProps = {
  projects: ProjectListItem[];
};

const DashboardScreen = ({ projects }: DashboardScreenProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter((p) => p.title.toLowerCase().includes(normalized));
  }, [projects, query]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Dashboard ({projects.length})</Text>
      <TextInput
        placeholder="Search projects"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <ProjectList items={filteredProjects} />
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

    bottom: "12%",
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
