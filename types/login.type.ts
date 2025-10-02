export interface Login {
  phone: string;
  password: string;
}
export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: {
    id: number;
    is_admin: boolean;
    role: string;
    store_id: number;
    employee_id: number;
    permissions: string[];
  };
}
