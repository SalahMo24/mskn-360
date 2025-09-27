import { View, Text, StyleSheet, Image } from "react-native";

const ProjectCard = ({
  image,
  title,
  createdAt,
}: {
  image: string;
  title: string;
  createdAt: Date;
}) => {
  return (
    <View style={styles.container}>
      <Image source={{ uri: image }} style={styles.image} />
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.createdAt}>
          {new Date(createdAt).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 10,
    backgroundColor: "white",
    gap: 10,
    height: 90,
    // boxShadow: "0 0 10px 0 rgba(0, 0, 0, 0.1)",
    // elevation: 1,
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.25,
    // shadowRadius: 3.84,
    // borderWidth: 1,
    // borderColor: "#e5e7eb",
  },
  image: {
    width: "33%",
    height: "100%",
    borderRadius: 10,
  },
  info: {
    width: "67%",
    gap: 5,
    flexDirection: "column",
    paddingVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
  },
  createdAt: {
    fontSize: 12,
    color: "gray",
  },
});
export default ProjectCard;
