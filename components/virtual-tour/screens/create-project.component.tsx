import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useCoordinates from "../../../hooks/virtual-tour/coordinates.hook";
import useCreateVirtualTour from "../../../hooks/virtual-tour/create-virtual-tour.hook";

export default function CreateProject() {
  const [name, setName] = useState("");
  const { createVirtualTour, isCreating, error } = useCreateVirtualTour();
  const { loading: coordinatesLoading } = useCoordinates();
  const router = useRouter();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Validation", "Please enter a project name.");
      return;
    }

    try {
      const res = await createVirtualTour({
        virtual_tour_name: name,
        virtual_tour_description: null,
        store_id: 1,
        employee_id: 1,
        created_by: "user",
        // The hook injects coordinates; scenes is required by the type, provide a minimal stub
        scenes: { image: "", scene: "room" as any },
      } as any);

      if (res) {
        // Navigate to project details using the returned project ID
        router.replace(`/project-details/${res.data?.id}` as any);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to create project");
    }
  };

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
      <View style={styles.content}>
        <Text style={styles.title}>Create Project</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Project name"
          style={styles.input}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        {!!error && <Text style={styles.errorText}>{error.message}</Text>}
      </View>
      <Pressable
        onPress={handleCreate}
        disabled={isCreating || coordinatesLoading}
        style={({ pressed }) => [
          styles.button,
          pressed && { opacity: 0.9 },
          isCreating && { opacity: 0.6 },
        ]}
      >
        <Text style={styles.buttonText}>
          {isCreating ? "Creating..." : "Create"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",

    gap: 12,
    position: "relative",
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "white",
  },
  button: {
    backgroundColor: "#00674f",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    bottom: "12%",
    left: 16,
    right: 16,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#dc2626",
  },
});
