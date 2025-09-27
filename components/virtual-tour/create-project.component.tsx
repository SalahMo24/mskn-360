import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import useCoordinates from "../../hooks/virtual-tour/coordinates.hook";
import useCreateVirtualTour from "../../hooks/virtual-tour/create-virtual-tour.hook";

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
        router.replace("/");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to create project");
    }
  };

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    padding: 16,
    gap: 12,
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
