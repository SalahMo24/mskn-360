export interface Hotspot {
  id: string;
  longitude: number;
  latitude: number;
  label: string;
  to: string; // target scene ID
  image: string;
}

export interface Scene {
  id: string;
  image: string;
  hotspots: Hotspot[];
}

export interface Tour {
  scenes: Scene[];
}
export type VirtualTourResponse = {
  virtual_tour: Tour | null;
  id: number;
  virtual_tour_name: string;
  virtual_tour_description: string | null;
  store_id: number;
  created_at: Date;
  updated_at: Date;
  is_deleted: boolean;
  coordinates: unknown;
  virtual_tour_version: number;
  employee_id: number;
  created_by: string;
};

export enum VirtualTourSceneType {
  BEDROOM = "bedroom",
  LIVING_ROOM = "living_room",
  KITCHEN = "kitchen",
  BATHROOM = "bathroom",
  GARAGE = "garage",
  POOL = "pool",
  GARDEN = "garden",
  ROOM = "room",
  DINING_ROOM = "dining_room",
  OFFICE = "office",
  STUDY = "study",
  STORAGE = "storage",
  BALCONY = "balcony",
  LOUNGE = "lounge",
  HALL = "hall",
  ENTRANCE = "entrance",
  OTHER = "other",
}
export type Coordinates = {
  longitude: number;
  latitude: number;
};
export type VirtualTourCreate = {
  virtual_tour_name: string;
  virtual_tour_description: string | null;
  store_id: number;
  employee_id: number;
  created_by: string;
  coordinates: Coordinates;

  scenes: { image: string; scene: VirtualTourSceneType };
};
