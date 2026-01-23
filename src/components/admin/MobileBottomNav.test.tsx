import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n/config";
import MobileBottomNav from "./MobileBottomNav";
import { setViewport, resetViewport } from "@/test/utils/viewport";

// Test wrapper with i18n
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

// Default props for rendering
const createDefaultProps = () => ({
  currentView: "calendar" as const,
  onViewChange: vi.fn(),
  onAddReservation: vi.fn(),
  onLogout: vi.fn(),
  unreadNotificationsCount: 0,
  offersEnabled: false,
  followupEnabled: false,
  hallViewEnabled: false,
  protocolsEnabled: false,
  userRole: "admin" as const,
  currentVersion: "1.0.0",
});

// Helper to render component
const renderNav = (props = {}) => {
  const defaultProps = createDefaultProps();
  const mergedProps = { ...defaultProps, ...props };
  return {
    ...render(
      <TestWrapper>
        <MobileBottomNav {...mergedProps} />
      </TestWrapper>
    ),
    props: mergedProps,
  };
};

// Helper to get nav element
const getNav = () => document.querySelector("nav")!;

// Helper to get button by icon class (lucide icon names)
const getButtonByIcon = (iconClass: string, container?: Element) => {
  const root = container || document;
  return root.querySelector(`svg.lucide-${iconClass}`)?.closest("button");
};

// Helper to open "More" menu
const openMoreMenu = async () => {
  // MoreHorizontal icon renders as lucide-ellipsis
  const moreButton = getButtonByIcon("ellipsis", getNav());
  expect(moreButton).toBeDefined();
  fireEvent.click(moreButton!);
  await waitFor(() => {
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
};

// Helper to count menu items in sheet
const countMenuItemsInSheet = () => {
  const dialog = screen.getByRole("dialog");
  // Menu items are buttons inside the sheet with specific structure
  const menuButtons = within(dialog).getAllByRole("button").filter((btn) => {
    // Exclude close button (X) and logout button
    const hasLogoutIcon = btn.querySelector("svg.lucide-log-out");
    const hasCloseIcon = btn.querySelector("svg.lucide-x");
    return !hasLogoutIcon && !hasCloseIcon;
  });
  return menuButtons.length;
};

describe("MobileBottomNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setViewport("mobile");
  });

  afterEach(() => {
    resetViewport();
  });

  // ========================================
  // GRUPA A: Podstawowe renderowanie (NAV-U-001 do NAV-U-010)
  // ========================================
  describe("Grupa A: Podstawowe renderowanie", () => {
    it("NAV-U-001: Renderuje 5 głównych przycisków nawigacji", () => {
      renderNav();
      
      const nav = getNav();
      expect(nav).toBeInTheDocument();
      
      // Should have 5 interactive elements in bottom nav
      const buttons = nav.querySelectorAll("button");
      expect(buttons.length).toBe(5);
    });

    it("NAV-U-002: Przycisk centralny (Plus) wywołuje onAddReservation", () => {
      const { props } = renderNav();
      
      // Find the Plus button by icon
      const centralButton = getButtonByIcon("plus", getNav());
      
      expect(centralButton).toBeDefined();
      fireEvent.click(centralButton!);
      expect(props.onAddReservation).toHaveBeenCalledTimes(1);
    });

    it("NAV-U-003: Kliknięcie Kalendarz wywołuje onViewChange('calendar')", () => {
      const { props } = renderNav({ currentView: "reservations" });
      
      const calendarButton = getButtonByIcon("calendar", getNav());
      expect(calendarButton).toBeDefined();
      fireEvent.click(calendarButton!);
      expect(props.onViewChange).toHaveBeenCalledWith("calendar");
    });

    it("NAV-U-004: Kliknięcie Rezerwacje wywołuje onViewChange('reservations')", () => {
      const { props } = renderNav();
      
      const listButton = getButtonByIcon("list", getNav());
      expect(listButton).toBeDefined();
      fireEvent.click(listButton!);
      expect(props.onViewChange).toHaveBeenCalledWith("reservations");
    });

    it("NAV-U-005: Kliknięcie Powiadomienia wywołuje onViewChange('notifications')", () => {
      const { props } = renderNav();
      
      const bellButton = getButtonByIcon("bell", getNav());
      expect(bellButton).toBeDefined();
      fireEvent.click(bellButton!);
      expect(props.onViewChange).toHaveBeenCalledWith("notifications");
    });

    it("NAV-U-006: Badge powiadomień wyświetla się gdy unreadNotificationsCount > 0", () => {
      renderNav({ unreadNotificationsCount: 5 });
      
      const nav = getNav();
      const badges = nav.querySelectorAll(".bg-destructive.rounded-full");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("NAV-U-007: Badge powiadomień jest ukryty gdy unreadNotificationsCount === 0", () => {
      renderNav({ unreadNotificationsCount: 0 });
      
      const nav = getNav();
      const badges = nav.querySelectorAll(".bg-destructive.rounded-full");
      expect(badges.length).toBe(0);
    });

    it("NAV-U-008: Aktywny widok ma klasę text-primary", () => {
      renderNav({ currentView: "calendar" });
      
      const calendarButton = getButtonByIcon("calendar", getNav());
      expect(calendarButton).toHaveClass("text-primary");
    });

    it("NAV-U-009: Nieaktywny widok ma klasę text-muted-foreground", () => {
      renderNav({ currentView: "calendar" });
      
      const listButton = getButtonByIcon("list", getNav());
      expect(listButton).toHaveClass("text-muted-foreground");
    });

    it("NAV-U-010: Wyświetla wersję aplikacji w menu Więcej", async () => {
      renderNav({ currentVersion: "2.5.0" });
      
      await openMoreMenu();
      
      expect(screen.getByText(/v2\.5\.0/)).toBeInTheDocument();
    });
  });

  // ========================================
  // GRUPA B: Sheet "Więcej" (NAV-U-011 do NAV-U-020)
  // ========================================
  describe("Grupa B: Sheet Więcej - podstawowa funkcjonalność", () => {
    it("NAV-U-011: Kliknięcie Więcej otwiera Sheet", async () => {
      renderNav();
      
      const moreButton = getButtonByIcon("ellipsis", getNav());
      fireEvent.click(moreButton!);
      
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("NAV-U-012: Sheet zawiera przycisk zamknięcia (X)", async () => {
      renderNav();
      await openMoreMenu();
      
      const dialog = screen.getByRole("dialog");
      const closeButton = getButtonByIcon("x", dialog);
      expect(closeButton).toBeInTheDocument();
    });

    it("NAV-U-013: Kliknięcie X zamyka Sheet", async () => {
      renderNav();
      await openMoreMenu();
      
      const dialog = screen.getByRole("dialog");
      const closeButton = getButtonByIcon("x", dialog);
      fireEvent.click(closeButton!);
      
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("NAV-U-014: Sheet zawiera przycisk wylogowania", async () => {
      renderNav();
      await openMoreMenu();
      
      const dialog = screen.getByRole("dialog");
      const logoutButton = getButtonByIcon("log-out", dialog);
      expect(logoutButton).toBeInTheDocument();
    });

    it("NAV-U-015: Przycisk wylogowania wywołuje onLogout", async () => {
      const { props } = renderNav();
      await openMoreMenu();
      
      const dialog = screen.getByRole("dialog");
      const logoutButton = getButtonByIcon("log-out", dialog);
      fireEvent.click(logoutButton!);
      
      expect(props.onLogout).toHaveBeenCalledTimes(1);
    });

    it("NAV-U-016: Kliknięcie pozycji menu wywołuje onViewChange z odpowiednim typem", async () => {
      vi.useFakeTimers();
      const { props } = renderNav();
      await openMoreMenu();
      
      // Click on "Klienci" menu item
      const customersButton = screen.getByText(/Klienci/i).closest("button");
      fireEvent.click(customersButton!);
      
      // Wait for the setTimeout in handleMoreMenuItemClick
      vi.advanceTimersByTime(150);
      
      expect(props.onViewChange).toHaveBeenCalledWith("customers");
      vi.useRealTimers();
    });

    it("NAV-U-017: Kliknięcie pozycji menu zamyka Sheet", async () => {
      renderNav();
      await openMoreMenu();
      
      const customersButton = screen.getByText(/Klienci/i).closest("button");
      fireEvent.click(customersButton!);
      
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("NAV-U-018: Badge przy powiadomieniach w Sheet wyświetla liczbę", async () => {
      renderNav({ unreadNotificationsCount: 7 });
      await openMoreMenu();
      
      // Badge should show the count
      expect(screen.getByText("7")).toBeInTheDocument();
    });

    it("NAV-U-019: Aktywna pozycja menu ma wyróżnione tło (bg-muted)", async () => {
      renderNav({ currentView: "customers" });
      await openMoreMenu();
      
      const customersButton = screen.getByText(/Klienci/i).closest("button");
      expect(customersButton).toHaveClass("bg-muted");
    });

    it("NAV-U-020: Zawsze widoczne - Kalendarz, Rezerwacje, Klienci, Powiadomienia", async () => {
      renderNav({
        offersEnabled: false,
        hallViewEnabled: false,
        protocolsEnabled: false,
        userRole: "employee",
      });
      await openMoreMenu();
      
      expect(screen.getByText("Kalendarz")).toBeInTheDocument();
      expect(screen.getByText("Rezerwacje")).toBeInTheDocument();
      expect(screen.getByText(/Klienci/i)).toBeInTheDocument();
      expect(screen.getByText(/Powiadomienia/i)).toBeInTheDocument();
    });
  });

  // ========================================
  // GRUPA C: Feature flags - widoczność menu items (NAV-U-021 do NAV-U-030)
  // ========================================
  describe("Grupa C: Feature flags - widoczność menu items", () => {
    it("NAV-U-021: Oferty widoczne gdy offersEnabled=true", async () => {
      renderNav({ offersEnabled: true });
      await openMoreMenu();
      
      expect(screen.getByText(/Oferty/i)).toBeInTheDocument();
    });

    it("NAV-U-022: Oferty ukryte gdy offersEnabled=false", async () => {
      renderNav({ offersEnabled: false });
      await openMoreMenu();
      
      expect(screen.queryByText(/Oferty/i)).not.toBeInTheDocument();
    });

    it("NAV-U-023: Hale widoczne gdy hallViewEnabled=true i userRole=admin", async () => {
      renderNav({ hallViewEnabled: true, userRole: "admin" });
      await openMoreMenu();
      
      expect(screen.getByText(/Hale/i)).toBeInTheDocument();
    });

    it("NAV-U-024: Hale ukryte gdy hallViewEnabled=false", async () => {
      renderNav({ hallViewEnabled: false, userRole: "admin" });
      await openMoreMenu();
      
      expect(screen.queryByText(/Hale/i)).not.toBeInTheDocument();
    });

    it("NAV-U-025: Hale ukryte gdy hallViewEnabled=true ale userRole=employee", async () => {
      renderNav({ hallViewEnabled: true, userRole: "employee" });
      await openMoreMenu();
      
      expect(screen.queryByText(/Hale/i)).not.toBeInTheDocument();
    });

    it("NAV-U-026: Protokoły widoczne gdy protocolsEnabled=true i userRole=admin", async () => {
      renderNav({ protocolsEnabled: true, userRole: "admin" });
      await openMoreMenu();
      
      expect(screen.getByText("Protokoły")).toBeInTheDocument();
    });

    it("NAV-U-027: Protokoły ukryte gdy protocolsEnabled=false", async () => {
      renderNav({ protocolsEnabled: false, userRole: "admin" });
      await openMoreMenu();
      
      expect(screen.queryByText("Protokoły")).not.toBeInTheDocument();
    });

    it("NAV-U-028: Protokoły ukryte gdy protocolsEnabled=true ale userRole=employee", async () => {
      renderNav({ protocolsEnabled: true, userRole: "employee" });
      await openMoreMenu();
      
      expect(screen.queryByText("Protokoły")).not.toBeInTheDocument();
    });

    it("NAV-U-029: Ustawienia widoczne dla userRole=admin", async () => {
      renderNav({ userRole: "admin" });
      await openMoreMenu();
      
      expect(screen.getByText(/Ustawienia/i)).toBeInTheDocument();
    });

    it("NAV-U-030: Ustawienia ukryte dla userRole=employee", async () => {
      renderNav({ userRole: "employee" });
      await openMoreMenu();
      
      expect(screen.queryByText(/Ustawienia/i)).not.toBeInTheDocument();
    });
  });

  // ========================================
  // GRUPA D: Kombinacje ról i features (NAV-U-031 do NAV-U-040)
  // ========================================
  describe("Grupa D: Kombinacje ról i features", () => {
    it("NAV-U-031: Admin z pełnymi features widzi wszystkie 8 pozycji menu", async () => {
      renderNav({
        offersEnabled: true,
        hallViewEnabled: true,
        protocolsEnabled: true,
        userRole: "admin",
      });
      await openMoreMenu();
      
      // Kalendarz, Rezerwacje, Klienci, Oferty, Hale, Protokoły, Powiadomienia, Ustawienia = 8
      const count = countMenuItemsInSheet();
      expect(count).toBe(8);
    });

    it("NAV-U-032: Admin bez żadnych features widzi 5 pozycji", async () => {
      renderNav({
        offersEnabled: false,
        hallViewEnabled: false,
        protocolsEnabled: false,
        userRole: "admin",
      });
      await openMoreMenu();
      
      // Kalendarz, Rezerwacje, Klienci, Powiadomienia, Ustawienia = 5
      const count = countMenuItemsInSheet();
      expect(count).toBe(5);
    });

    it("NAV-U-033: Employee z pełnymi features widzi 5 pozycji (bez Hale, Protokoły, Ustawienia)", async () => {
      renderNav({
        offersEnabled: true,
        hallViewEnabled: true,
        protocolsEnabled: true,
        userRole: "employee",
      });
      await openMoreMenu();
      
      // Kalendarz, Rezerwacje, Klienci, Oferty, Powiadomienia = 5
      const count = countMenuItemsInSheet();
      expect(count).toBe(5);
      
      // Verify hidden items
      expect(screen.queryByText(/Hale/i)).not.toBeInTheDocument();
      expect(screen.queryByText("Protokoły")).not.toBeInTheDocument();
      expect(screen.queryByText(/Ustawienia/i)).not.toBeInTheDocument();
    });

    it("NAV-U-034: Employee bez features widzi 4 pozycje", async () => {
      renderNav({
        offersEnabled: false,
        hallViewEnabled: false,
        protocolsEnabled: false,
        userRole: "employee",
      });
      await openMoreMenu();
      
      // Kalendarz, Rezerwacje, Klienci, Powiadomienia = 4
      const count = countMenuItemsInSheet();
      expect(count).toBe(4);
    });

    it("NAV-U-035: Admin tylko z offers widzi 6 pozycji", async () => {
      renderNav({
        offersEnabled: true,
        hallViewEnabled: false,
        protocolsEnabled: false,
        userRole: "admin",
      });
      await openMoreMenu();
      
      // Kalendarz, Rezerwacje, Klienci, Oferty, Powiadomienia, Ustawienia = 6
      const count = countMenuItemsInSheet();
      expect(count).toBe(6);
    });

    it("NAV-U-036: Admin tylko z hallView widzi 6 pozycji", async () => {
      renderNav({
        offersEnabled: false,
        hallViewEnabled: true,
        protocolsEnabled: false,
        userRole: "admin",
      });
      await openMoreMenu();
      
      // Kalendarz, Rezerwacje, Klienci, Hale, Powiadomienia, Ustawienia = 6
      const count = countMenuItemsInSheet();
      expect(count).toBe(6);
    });

    it("NAV-U-037: Employee tylko z offers widzi 5 pozycji", async () => {
      renderNav({
        offersEnabled: true,
        hallViewEnabled: false,
        protocolsEnabled: false,
        userRole: "employee",
      });
      await openMoreMenu();
      
      // Kalendarz, Rezerwacje, Klienci, Oferty, Powiadomienia = 5
      const count = countMenuItemsInSheet();
      expect(count).toBe(5);
    });

    it("NAV-U-038: Kolejność menu items jest zachowana (Kalendarz pierwszy, Ustawienia ostatnie)", async () => {
      renderNav({
        offersEnabled: true,
        hallViewEnabled: true,
        protocolsEnabled: true,
        userRole: "admin",
      });
      await openMoreMenu();
      
      const dialog = screen.getByRole("dialog");
      const menuButtons = within(dialog).getAllByRole("button").filter((btn) => {
        const hasLogoutIcon = btn.querySelector("svg.lucide-log-out");
        const hasCloseIcon = btn.querySelector("svg.lucide-x");
        return !hasLogoutIcon && !hasCloseIcon;
      });
      
      // First should be Kalendarz
      expect(menuButtons[0].textContent).toContain("Kalendarz");
      // Last should be Ustawienia
      expect(menuButtons[menuButtons.length - 1].textContent).toMatch(/Ustawienia/i);
    });

    it("NAV-U-039: Menu items mają poprawne ikony", async () => {
      renderNav({
        offersEnabled: true,
        hallViewEnabled: true,
        protocolsEnabled: true,
        userRole: "admin",
      });
      await openMoreMenu();
      
      const dialog = screen.getByRole("dialog");
      
      // Check for specific icons
      expect(dialog.querySelector("svg.lucide-calendar")).toBeInTheDocument();
      expect(dialog.querySelector("svg.lucide-list")).toBeInTheDocument();
      expect(dialog.querySelector("svg.lucide-users")).toBeInTheDocument();
      expect(dialog.querySelector("svg.lucide-file-text")).toBeInTheDocument();
      expect(dialog.querySelector("svg.lucide-building-2")).toBeInTheDocument();
      expect(dialog.querySelector("svg.lucide-clipboard-check")).toBeInTheDocument();
      expect(dialog.querySelector("svg.lucide-bell")).toBeInTheDocument();
      expect(dialog.querySelector("svg.lucide-settings")).toBeInTheDocument();
    });

    it("NAV-U-040: Badge notification widoczny zarówno w głównym nav jak i Sheet", async () => {
      renderNav({ unreadNotificationsCount: 3 });
      
      // Check badge in bottom nav
      const nav = getNav();
      const navBadges = nav.querySelectorAll(".bg-destructive.rounded-full");
      expect(navBadges.length).toBeGreaterThan(0);
      
      // Open sheet and check badge there
      await openMoreMenu();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  // ========================================
  // GRUPA E: Responsywność (NAV-U-041 do NAV-U-045)
  // ========================================
  describe("Grupa E: Responsywność", () => {
    it("NAV-U-041: Na mobile (375px) - MobileBottomNav jest widoczny", () => {
      setViewport("mobile");
      renderNav();
      
      const nav = getNav();
      expect(nav).toBeInTheDocument();
      // Nav has lg:hidden class
      expect(nav).toHaveClass("lg:hidden");
    });

    it("NAV-U-042: Nav ma klasę lg:hidden (ukryty na desktop)", () => {
      renderNav();
      
      const nav = getNav();
      expect(nav).toHaveClass("lg:hidden");
    });

    it("NAV-U-043: Sheet ma pełną szerokość na mobile (w-full)", async () => {
      setViewport("mobile");
      renderNav();
      await openMoreMenu();
      
      const sheetContent = document.querySelector("[data-radix-dialog-content]");
      expect(sheetContent).toHaveClass("w-full");
    });

    it("NAV-U-044: Przyciski nawigacji mają odpowiedni rozmiar dotyku (h-12 w-12)", () => {
      renderNav();
      
      const nav = getNav();
      const buttons = nav.querySelectorAll("button.h-12.w-12");
      // Should have 4 regular buttons (Calendar, List, Bell, More) - Plus is different size
      expect(buttons.length).toBe(4);
    });

    it("NAV-U-045: Centralny przycisk Plus jest wyróżniony wizualnie (h-14 w-14 rounded-full)", () => {
      renderNav();
      
      const plusButton = document.querySelector("button.h-14.w-14.rounded-full");
      expect(plusButton).toBeInTheDocument();
      expect(plusButton).toHaveClass("bg-primary");
    });
  });

  // ========================================
  // DODATKOWE TESTY: Edge cases
  // ========================================
  describe("Edge cases", () => {
    it("Obsługuje userRole=null jako admin", async () => {
      renderNav({ userRole: null, offersEnabled: true });
      await openMoreMenu();
      
      // Should show admin-only items when role is null (default behavior)
      expect(screen.getByText(/Ustawienia/i)).toBeInTheDocument();
    });

    it("Obsługuje brak currentVersion gracefully", async () => {
      renderNav({ currentVersion: undefined });
      await openMoreMenu();
      
      // Should still show "Panel Admina" without version
      expect(screen.getByText(/Panel Admina/)).toBeInTheDocument();
    });

    it("Wielokrotne otwieranie/zamykanie Sheet działa poprawnie", async () => {
      renderNav();
      
      // Open
      await openMoreMenu();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      
      // Close
      const closeButton = getButtonByIcon("x", screen.getByRole("dialog"));
      fireEvent.click(closeButton!);
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      
      // Open again
      await openMoreMenu();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("Badge w More button pojawia się gdy są nieprzeczytane powiadomienia", () => {
      renderNav({ unreadNotificationsCount: 1 });
      
      const moreButton = getButtonByIcon("ellipsis", getNav());
      const badge = moreButton?.querySelector(".bg-destructive.rounded-full");
      expect(badge).toBeInTheDocument();
    });

    it("More button jest aktywny gdy currentView jest w menu więcej", () => {
      renderNav({ currentView: "settings" });
      
      const moreButton = getButtonByIcon("ellipsis", getNav());
      expect(moreButton).toHaveClass("text-primary");
    });
  });
});
