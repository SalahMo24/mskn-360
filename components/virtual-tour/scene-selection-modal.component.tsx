import React from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { VirtualTourSceneType } from "../../types/virtual-tour.type";

interface SceneSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSceneSelect: (scene: VirtualTourSceneType) => void;
  projectId: string;
}

const SceneSelectionModal: React.FC<SceneSelectionModalProps> = ({
  visible,
  onClose,
  onSceneSelect,
  projectId,
}) => {
  const sceneTypes = Object.values(VirtualTourSceneType);

  const handleSceneSelect = (scene: VirtualTourSceneType) => {
    onSceneSelect(scene);
    onClose();
  };

  const renderSceneItem = ({ item }: { item: VirtualTourSceneType }) => (
    <TouchableOpacity
      style={styles.sceneItem}
      onPress={() => handleSceneSelect(item)}
    >
      <Text style={styles.sceneText}>
        {item.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Select Scene Type</Text>
          <View style={styles.placeholder} />
        </View>

        <FlatList
          data={sceneTypes}
          renderItem={renderSceneItem}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: "#00674f",
    fontWeight: "500",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  placeholder: {
    width: 60,
  },
  listContainer: {
    padding: 16,
  },
  sceneItem: {
    backgroundColor: "#f9fafb",
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  sceneText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
    textTransform: "capitalize",
  },
});

export default SceneSelectionModal;
