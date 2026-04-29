import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
  Outlet: () => <div data-testid="outlet">Page Content</div>,
}));

const mockLogout = vi.fn();
const mockUseAuth = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../context/CartContext", () => ({
  useCart: () => ({ itemCount: 3 }),
}));

vi.mock("../context/NotificationContext", () => ({
  useNotification: () => ({ notifications: [], dismiss: vi.fn() }),
}));

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

describe("Layout", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      user: { username: "testuser" },
      logout: mockLogout,
    });
  });

  it("renders logo and navigation", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );

    expect(screen.getByText("E-Shop")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("shows cart badge with item count", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows username when authenticated", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );

    expect(screen.getByText("Hi, testuser")).toBeInTheDocument();
  });

  it("shows login/register links when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isAdmin: false,
      user: null,
      logout: mockLogout,
    });

    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );

    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Register")).toBeInTheDocument();
    expect(screen.queryByText("Logout")).not.toBeInTheDocument();
  });

  it("shows admin link for admin users", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isAdmin: true,
      user: { username: "admin" },
      logout: mockLogout,
    });

    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );

    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders the page outlet", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });
});
