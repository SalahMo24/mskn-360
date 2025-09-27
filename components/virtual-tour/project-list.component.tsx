import React from "react";
import { FlatList, View, StyleSheet, Text } from "react-native";
import ProjectCard from "./project-card.component";

export type ProjectListItem = {
  id: string;
  image: string;
  title: string;
  createdAt: Date | string;
};

const ProjectList = ({ items }: { items: ProjectListItem[] }) => {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <ProjectCard
          image={item.image}
          title={item.title}
          createdAt={item.createdAt as Date}
        />
      )}
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No projects found</Text>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 12,
  },
  separator: {
    // height: 8,
    // backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginVertical: 8,
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "gray",
  },
});

export default ProjectList;
