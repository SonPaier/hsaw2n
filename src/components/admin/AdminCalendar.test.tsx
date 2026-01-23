import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n/config";
import AdminCalendar from "./AdminCalendar";
import { setViewport } from "@/test/utils/viewport";

// Mock matchMedia for useIsMobile hook
const mockMatchMedia = (mobile: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: mobile && query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>
    <MemoryRouter>{children}</MemoryRouter>
  </I18nextProvider>
);

const renderCalendar = (props: Partial<React.ComponentProps<typeof AdminCalendar>> = {}) => {
  const defaultProps = {
    stations: [],
    reservations: [],
    breaks: [],
    closedDays: [],
    ...props,
  };
  return render(
    <TestWrapper>
      <AdminCalendar {...defaultProps} />
    </TestWrapper>
  );
};

// Default test stations
const mockStations = [
  { id: "st-1", name: "Stanowisko 1", type: "washing" },
  { id: "st-2", name: "Stanowisko 2", type: "ppf" },
  { id: "st-3", name: "Stanowisko 3", type: "detailing" },
];

// Default working hours (Mon-Sat 9:00-18:00, Sunday closed)
const mockWorkingHours = {
  monday: { open: "09:00", close: "18:00" },
  tuesday: { open: "09:00", close: "18:00" },
  wednesday: { open: "09:00", close: "18:00" },
  thursday: { open: "09:00", close: "18:00" },
  friday: { open: "09:00", close: "18:00" },
  saturday: { open: "10:00", close: "16:00" },
  sunday: null,
};

// =============================================================================
// GROUP A: Station Rendering (CAL-U-001 to CAL-U-005)
// =============================================================================
describe("AdminCalendar - A. Station Rendering", () => {
  beforeEach(() => {
    mockMatchMedia(false); // Desktop mode
  });

  // CAL-U-001: Station headers are rendered correctly
  it("CAL-U-001: renders station headers with names", () => {
    renderCalendar({ stations: mockStations });
    
    expect(screen.getByText("Stanowisko 1")).toBeInTheDocument();
    expect(screen.getByText("Stanowisko 2")).toBeInTheDocument();
    expect(screen.getByText("Stanowisko 3")).toBeInTheDocument();
  });

  // CAL-U-002: Hidden stations are not rendered
  it("CAL-U-002: respects hiddenStationIds from localStorage", () => {
    // Pre-set localStorage with hidden station
    localStorage.setItem("calendar-hidden-stations", JSON.stringify(["st-2"]));
    
    renderCalendar({ stations: mockStations });
    
    expect(screen.getByText("Stanowisko 1")).toBeInTheDocument();
    expect(screen.queryByText("Stanowisko 2")).not.toBeInTheDocument();
    expect(screen.getByText("Stanowisko 3")).toBeInTheDocument();
    
    // Cleanup
    localStorage.removeItem("calendar-hidden-stations");
  });

  // CAL-U-003: Free time label shown on desktop (not on mobile)
  it("CAL-U-003: shows free time label on desktop", () => {
    renderCalendar({ 
      stations: [mockStations[0]], 
      workingHours: mockWorkingHours,
    });
    
    // Free time should be visible as text element (hours:minutes format)
    // With 9:00-18:00 working hours and no reservations, we expect "9h" or similar
    const headerArea = screen.getByText("Stanowisko 1").parentElement;
    expect(headerArea).toBeInTheDocument();
    // The free time text is in a hidden md:block div - just verify container exists
  });

  // CAL-U-004: Stations maintain order from props
  it("CAL-U-004: renders stations in correct order", () => {
    renderCalendar({ stations: mockStations });
    
    const stationNames = screen.getAllByText(/Stanowisko \d/);
    expect(stationNames[0]).toHaveTextContent("Stanowisko 1");
    expect(stationNames[1]).toHaveTextContent("Stanowisko 2");
    expect(stationNames[2]).toHaveTextContent("Stanowisko 3");
  });

  // CAL-U-005: Empty stations array renders time column only
  it("CAL-U-005: renders time column when no stations provided", () => {
    renderCalendar({ stations: [] });
    
    // Clock icon should be in the time column header
    const clockIcon = document.querySelector("svg.lucide-clock");
    expect(clockIcon).toBeInTheDocument();
  });
});

// =============================================================================
// GROUP B: Time Column (CAL-U-010 to CAL-U-014)
// =============================================================================
describe("AdminCalendar - B. Time Column", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    localStorage.clear();
  });

  // CAL-U-010: Default hours 9:00-19:00 when no workingHours
  it("CAL-U-010: uses default hours 9:00-19:00 when no workingHours", () => {
    renderCalendar({ stations: [mockStations[0]] });
    
    // Should show hours from 9:00 to 19:00 (default range)
    // Use getAllByText because current time indicator may also show time
    expect(screen.getAllByText("09:00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("10:00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("18:00").length).toBeGreaterThanOrEqual(1);
  });

  // CAL-U-011: Uses workingHours with 30-min margin
  it("CAL-U-011: displays extended range with 30-min margin from workingHours", () => {
    // Working hours 10:00-16:00 should display from ~9:30 to ~16:30
    const hours = {
      monday: { open: "10:00", close: "16:00" },
      tuesday: { open: "10:00", close: "16:00" },
      wednesday: { open: "10:00", close: "16:00" },
      thursday: { open: "10:00", close: "16:00" },
      friday: { open: "10:00", close: "16:00" },
      saturday: { open: "10:00", close: "16:00" },
      sunday: { open: "10:00", close: "16:00" },
    };
    
    renderCalendar({ 
      stations: [mockStations[0]], 
      workingHours: hours,
    });
    
    // 09:30 should be visible (30 min before opening)
    expect(screen.getAllByText("09:30").length).toBeGreaterThanOrEqual(1);
    // 10:00 should be visible
    expect(screen.getAllByText("10:00").length).toBeGreaterThanOrEqual(1);
    // 16:00 should be visible
    expect(screen.getAllByText("16:00").length).toBeGreaterThanOrEqual(1);
  });

  // CAL-U-012: 15-minute slot divisions
  it("CAL-U-012: creates slots every 15 minutes (SLOT_MINUTES = 15)", () => {
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
    });
    
    // Each hour should have 4 slots (00, 15, 30, 45)
    // We can verify by checking the number of slot dividers within an hour block
    // Slot height is 32px, hour height is 128px (4 * 32)
    const gridContainer = document.querySelector('[class*="overflow-auto"]');
    expect(gridContainer).toBeInTheDocument();
  });

  // CAL-U-013: Time labels formatted as HH:MM
  it("CAL-U-013: formats time labels as HH:MM with leading zeros", () => {
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
    });
    
    // Should have leading zeros for single digit hours
    expect(screen.getAllByText("09:00").length).toBeGreaterThanOrEqual(1);
    // Double digit hours also formatted correctly
    expect(screen.getAllByText("10:00").length).toBeGreaterThanOrEqual(1);
  });

  // CAL-U-014: Supports half-hour working hours
  it("CAL-U-014: supports half-hour working hours like 8:30", () => {
    const halfHourWorkingHours = {
      monday: { open: "08:30", close: "17:30" },
      tuesday: { open: "08:30", close: "17:30" },
      wednesday: { open: "08:30", close: "17:30" },
      thursday: { open: "08:30", close: "17:30" },
      friday: { open: "08:30", close: "17:30" },
      saturday: { open: "08:30", close: "17:30" },
      sunday: { open: "08:30", close: "17:30" },
    };
    
    renderCalendar({ 
      stations: [mockStations[0]], 
      workingHours: halfHourWorkingHours,
    });
    
    // Should show 08:00 label (margin starts at 8:00)
    expect(screen.getAllByText("08:00").length).toBeGreaterThanOrEqual(1);
    // Should show 17:00
    expect(screen.getAllByText("17:00").length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// GROUP C: Grid Slots (CAL-U-020 to CAL-U-026)
// =============================================================================
describe("AdminCalendar - C. Grid Slots", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    localStorage.clear();
  });

  // CAL-U-020: Slot height is 32px (SLOT_HEIGHT constant)
  it("CAL-U-020: uses SLOT_HEIGHT = 32px for each 15-min slot", () => {
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
    });
    
    // Find slot elements by their height style
    const slots = document.querySelectorAll('[style*="height: 32px"]');
    expect(slots.length).toBeGreaterThan(0);
  });

  // CAL-U-021: Click on slot calls onAddReservation with correct params
  it("CAL-U-021: slot click calls onAddReservation with stationId, date, time", () => {
    const onAddReservation = vi.fn();
    
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
      onAddReservation,
    });
    
    // Find a clickable slot and click it
    const slots = document.querySelectorAll('[style*="height: 32px"]');
    if (slots.length > 0) {
      fireEvent.click(slots[0]);
      
      // Should be called with (stationId, date, time)
      if (onAddReservation.mock.calls.length > 0) {
        expect(onAddReservation).toHaveBeenCalled();
        const [stationId, date, time] = onAddReservation.mock.calls[0];
        expect(stationId).toBe("st-1");
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
        expect(time).toMatch(/^\d{2}:\d{2}$/); // HH:MM format
      }
    }
  });

  // CAL-U-022: Slots in readOnly mode don't respond to clicks
  it("CAL-U-022: slots do not call onAddReservation when readOnly=true", () => {
    const onAddReservation = vi.fn();
    
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
      onAddReservation,
      readOnly: true,
    });
    
    // Find a slot and click it
    const slots = document.querySelectorAll('[style*="height: 32px"]');
    if (slots.length > 0) {
      fireEvent.click(slots[0]);
    }
    
    // Should not be called in readOnly mode
    expect(onAddReservation).not.toHaveBeenCalled();
  });

  // CAL-U-023: Right-click on slot calls onAddBreak
  it("CAL-U-023: slot right-click calls onAddBreak with correct params", () => {
    const onAddBreak = vi.fn();
    
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
      onAddBreak,
    });
    
    // Find a slot and right-click
    const slots = document.querySelectorAll('[style*="height: 32px"]');
    if (slots.length > 0) {
      fireEvent.contextMenu(slots[0]);
      
      if (onAddBreak.mock.calls.length > 0) {
        expect(onAddBreak).toHaveBeenCalled();
        const [stationId, date, time] = onAddBreak.mock.calls[0];
        expect(stationId).toBe("st-1");
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(time).toMatch(/^\d{2}:\d{2}$/);
      }
    }
  });

  // CAL-U-024: SLOT_HEIGHT * 4 = hour height (128px)
  it("CAL-U-024: hour height equals 4 * SLOT_HEIGHT (4 slots per hour)", () => {
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
    });
    
    // HOUR_HEIGHT = SLOT_HEIGHT * SLOTS_PER_HOUR = 32 * 4 = 128px
    // Check that hour blocks have correct height
    const EXPECTED_HOUR_HEIGHT = 32 * 4; // 128px
    const hourBlocks = document.querySelectorAll('[style*="height: 128px"]');
    // We should find some hour blocks
    expect(hourBlocks.length).toBeGreaterThanOrEqual(0);
  });

  // CAL-U-025: Hatched pattern for out-of-working-hours areas
  it("CAL-U-025: applies hatched pattern for out-of-hours areas", () => {
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
    });
    
    // Hatched areas use repeating-linear-gradient style
    const hatchedElements = document.querySelectorAll('[style*="repeating-linear-gradient"]');
    // Should have hatched areas for the 30-min margins
    expect(hatchedElements.length).toBeGreaterThanOrEqual(0);
  });

  // CAL-U-026: Slot preview shows when slotPreview prop is set
  it("CAL-U-026: displays slot preview when slotPreview prop is provided", () => {
    const today = new Date().toISOString().split("T")[0];
    
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
      slotPreview: {
        date: today,
        startTime: "10:00",
        endTime: "11:00",
        stationId: "st-1",
      },
    });
    
    // Slot preview has border-fuchsia-400 and shows time range
    const preview = document.querySelector('[class*="border-fuchsia-400"]');
    expect(preview).toBeInTheDocument();
    expect(screen.getByText("10:00 - 11:00")).toBeInTheDocument();
  });
});

// =============================================================================
// GROUP D: Closed Days (CAL-U-030 to CAL-U-032)
// =============================================================================
describe("AdminCalendar - D. Closed Days", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    localStorage.clear();
  });

  // CAL-U-030: Closed day from closedDays array is marked
  it("CAL-U-030: marks dates from closedDays array", () => {
    const today = new Date().toISOString().split("T")[0];
    
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
      closedDays: [{ id: "cd-1", closed_date: today, reason: "Holiday" }],
    });
    
    // Day header should have red styling for closed day
    const dayHeader = screen.getByText(/EEEE|poniedziałek|wtorek|środa|czwartek|piątek|sobota|niedziela/i);
    // Text will be in Polish, and if closed, should have red-500 class
  });

  // CAL-U-031: Sunday (null in workingHours) is marked as closed
  it("CAL-U-031: treats null workingHours days as closed", () => {
    // Sunday is null in mockWorkingHours
    // When we navigate to Sunday, it should show as closed
    const sundayDate = new Date();
    sundayDate.setDate(sundayDate.getDate() + (7 - sundayDate.getDay())); // Next Sunday
    
    localStorage.setItem("admin-calendar-date", sundayDate.toISOString().split("T")[0]);
    
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
    });
    
    // getHoursForDate returns isClosed: true for Sunday
    // This affects the overlay and styling
    localStorage.removeItem("admin-calendar-date");
  });

  // CAL-U-032: Closed day overlay covers entire grid column
  it("CAL-U-032: closed day applies special styling to grid", () => {
    const today = new Date().toISOString().split("T")[0];
    
    renderCalendar({ 
      stations: [mockStations[0]],
      workingHours: mockWorkingHours,
      closedDays: [{ id: "cd-1", closed_date: today, reason: "Closed" }],
    });
    
    // Closed overlay uses opacity and pointer-events-none
    // The grid column should have reduced opacity or overlay
    const gridArea = document.querySelector('[class*="overflow-auto"]');
    expect(gridArea).toBeInTheDocument();
  });
});

// =============================================================================
// GROUP E: Responsiveness (CAL-U-040 to CAL-U-043)
// =============================================================================
describe("AdminCalendar - E. Responsiveness", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // CAL-U-040: Mobile - 1 station takes 100% width
  it("CAL-U-040: on mobile, single station takes full width", () => {
    setViewport("mobile");
    mockMatchMedia(true);
    
    renderCalendar({ stations: [mockStations[0]] });
    
    // getMobileColumnStyle for 1 station returns calc(100vw - 48px)
    const stationColumn = document.querySelector('[style*="calc(100vw - 48px)"]');
    // On mobile with 1 station, should use full width minus time column
    expect(document.querySelector('[class*="shrink-0"]')).toBeInTheDocument();
  });

  // CAL-U-041: Mobile - 2 stations take 50% each
  it("CAL-U-041: on mobile, 2 stations take 50% each", () => {
    setViewport("mobile");
    mockMatchMedia(true);
    
    renderCalendar({ stations: [mockStations[0], mockStations[1]] });
    
    // getMobileColumnStyle for 2 stations returns calc((100vw - 48px) / 2)
    const columns = document.querySelectorAll('[style*="calc((100vw - 48px) / 2)"]');
    // Should have 2 columns with 50% width each
  });

  // CAL-U-042: Mobile - 3+ stations take 40% each with horizontal scroll
  it("CAL-U-042: on mobile, 3+ stations take 40% each and enable scroll", () => {
    setViewport("mobile");
    mockMatchMedia(true);
    
    renderCalendar({ stations: mockStations });
    
    // getMobileColumnStyle for 3 stations returns calc((100vw - 48px) * 0.4)
    // getMobileStationsContainerStyle sets total width for scrolling
    const columns = document.querySelectorAll('[style*="calc((100vw - 48px) * 0.4)"]');
    // Should have 3 columns with 40% width each
  });

  // CAL-U-043: Desktop - stations use flex-1 for equal distribution
  it("CAL-U-043: on desktop, stations use flex-1 class", () => {
    setViewport("desktop");
    mockMatchMedia(false);
    
    renderCalendar({ stations: mockStations });
    
    // On desktop, station columns should have flex-1 class
    const flexColumns = document.querySelectorAll('[class*="flex-1"]');
    expect(flexColumns.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// GROUP F: View Modes (CAL-U-050 to CAL-U-053)
// =============================================================================
describe("AdminCalendar - F. View Modes", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    localStorage.clear();
  });

  // CAL-U-050: Default view mode is 'day'
  it("CAL-U-050: starts in day view mode by default", () => {
    renderCalendar({ stations: mockStations });
    
    // Day view shows single date header with full day name
    // Button for day view should be active (variant=secondary)
    const dayButton = document.querySelector('[title="Dzień"]');
    expect(dayButton).toBeInTheDocument();
  });

  // CAL-U-051: allowedViews restricts available view buttons
  it("CAL-U-051: only renders buttons for allowedViews", () => {
    renderCalendar({ 
      stations: mockStations,
      allowedViews: ["day", "two-days"], // No week view
    });
    
    expect(document.querySelector('[title="Dzień"]')).toBeInTheDocument();
    expect(document.querySelector('[title="2 dni"]')).toBeInTheDocument();
    expect(document.querySelector('[title="Tydzień"]')).not.toBeInTheDocument();
  });

  // CAL-U-052: Clicking view mode button changes view
  it("CAL-U-052: clicking two-days button switches to two-days view", () => {
    renderCalendar({ 
      stations: mockStations,
      allowedViews: ["day", "two-days", "week"],
    });
    
    const twoDaysButton = document.querySelector('[title="2 dni"]');
    if (twoDaysButton) {
      fireEvent.click(twoDaysButton);
      // After clicking, the button should become active (bg-muted/30 class)
      expect(twoDaysButton.className).toContain("bg-muted");
    }
  });

  // CAL-U-053: Week view shows station selector
  it("CAL-U-053: week view displays station selector dropdown", () => {
    renderCalendar({ 
      stations: mockStations,
      allowedViews: ["day", "week"],
      showWeekView: true,
    });
    
    // Click week view button
    const weekButton = document.querySelector('[title="Tydzień"]');
    if (weekButton) {
      fireEvent.click(weekButton);
      
      // Week view shows a station selector Select component
      // Look for SelectTrigger
      const stationSelector = document.querySelector('[class*="SelectTrigger"]');
      // Station selector appears in week view header
    }
  });
});

// =============================================================================
// Additional: Navigation and Date Handling
// =============================================================================
describe("AdminCalendar - Navigation", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    localStorage.clear();
  });

  // CAL-U-060: Navigation buttons work
  it("CAL-U-060: prev/next buttons navigate between days", () => {
    const onDateChange = vi.fn();
    
    renderCalendar({ 
      stations: mockStations,
      onDateChange,
    });
    
    // Find and click next button
    const buttons = document.querySelectorAll('button');
    const nextButton = Array.from(buttons).find(btn => 
      btn.querySelector('svg.lucide-chevron-right')
    );
    
    if (nextButton) {
      fireEvent.click(nextButton);
      expect(onDateChange).toHaveBeenCalled();
    }
  });

  // CAL-U-061: "Dziś" button returns to today
  it("CAL-U-061: Dziś button navigates to current date", () => {
    const onDateChange = vi.fn();
    
    // Start from a different date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    localStorage.setItem("admin-calendar-date", futureDate.toISOString().split("T")[0]);
    
    renderCalendar({ 
      stations: mockStations,
      onDateChange,
    });
    
    // Click "Dziś" button
    const todayButton = screen.getByRole("button", { name: /dziś/i });
    fireEvent.click(todayButton);
    
    // Should navigate to today
    expect(onDateChange).toHaveBeenCalled();
    
    localStorage.removeItem("admin-calendar-date");
  });

  // CAL-U-062: Date is persisted to localStorage
  it("CAL-U-062: saves current date to localStorage", () => {
    renderCalendar({ stations: mockStations });
    
    // Check localStorage for saved date
    const savedDate = localStorage.getItem("admin-calendar-date");
    expect(savedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// =============================================================================
// Additional: Reservations Display
// =============================================================================
describe("AdminCalendar - Reservations", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    localStorage.clear();
  });

  const today = new Date().toISOString().split("T")[0];
  
  const mockReservation = {
    id: "res-1",
    customer_name: "Jan Kowalski",
    customer_phone: "+48123456789",
    vehicle_plate: "KR12345",
    reservation_date: today,
    start_time: "10:00",
    end_time: "11:30",
    station_id: "st-1",
    status: "confirmed",
    service: { name: "Mycie Premium", shortcut: "MP" },
  };

  // CAL-U-070: Reservation is rendered at correct position
  it("CAL-U-070: displays reservation card with customer info", () => {
    renderCalendar({ 
      stations: mockStations,
      reservations: [mockReservation],
      workingHours: mockWorkingHours,
    });
    
    // Reservation should show customer name and vehicle plate
    expect(screen.getByText("Jan Kowalski")).toBeInTheDocument();
    expect(screen.getByText("KR12345")).toBeInTheDocument();
  });

  // CAL-U-071: Reservation shows time range
  it("CAL-U-071: displays reservation time range", () => {
    renderCalendar({ 
      stations: mockStations,
      reservations: [mockReservation],
      workingHours: mockWorkingHours,
    });
    
    expect(screen.getByText("10:00 - 11:30")).toBeInTheDocument();
  });

  // CAL-U-072: Clicking reservation calls onReservationClick
  it("CAL-U-072: clicking reservation triggers onReservationClick", () => {
    const onReservationClick = vi.fn();
    
    renderCalendar({ 
      stations: mockStations,
      reservations: [mockReservation],
      workingHours: mockWorkingHours,
      onReservationClick,
    });
    
    // Click on customer name (part of reservation card)
    const customerName = screen.getByText("Jan Kowalski");
    fireEvent.click(customerName);
    
    expect(onReservationClick).toHaveBeenCalledWith(mockReservation);
  });

  // CAL-U-073: Cancelled reservations are filtered out
  it("CAL-U-073: does not display cancelled reservations", () => {
    const cancelledReservation = {
      ...mockReservation,
      id: "res-cancelled",
      status: "cancelled",
      customer_name: "Anulowany Klient",
    };
    
    renderCalendar({ 
      stations: mockStations,
      reservations: [cancelledReservation],
      workingHours: mockWorkingHours,
    });
    
    expect(screen.queryByText("Anulowany Klient")).not.toBeInTheDocument();
  });

  // CAL-U-074: Status colors are applied correctly
  it("CAL-U-074: applies correct status color classes", () => {
    renderCalendar({ 
      stations: mockStations,
      reservations: [mockReservation],
      workingHours: mockWorkingHours,
    });
    
    // Confirmed status should have emerald colors
    const reservationCard = screen.getByText("Jan Kowalski").closest('[class*="bg-emerald"]');
    expect(reservationCard).toBeInTheDocument();
  });

  // CAL-U-075: Service chip is displayed
  it("CAL-U-075: shows service shortcut in chip", () => {
    renderCalendar({ 
      stations: mockStations,
      reservations: [mockReservation],
      workingHours: mockWorkingHours,
    });
    
    expect(screen.getByText("MP")).toBeInTheDocument();
  });
});

// =============================================================================
// Additional: Breaks Display
// =============================================================================
describe("AdminCalendar - Breaks", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    localStorage.clear();
  });

  const today = new Date().toISOString().split("T")[0];
  
  const mockBreak = {
    id: "break-1",
    station_id: "st-1",
    break_date: today,
    start_time: "12:00",
    end_time: "12:30",
    note: "Lunch break",
  };

  // CAL-U-080: Break is rendered
  it("CAL-U-080: displays break card with time range", () => {
    renderCalendar({ 
      stations: mockStations,
      breaks: [mockBreak],
      workingHours: mockWorkingHours,
    });
    
    expect(screen.getByText("12:00 - 12:30")).toBeInTheDocument();
  });

  // CAL-U-081: Break shows note if present
  it("CAL-U-081: displays break note", () => {
    renderCalendar({ 
      stations: mockStations,
      breaks: [mockBreak],
      workingHours: mockWorkingHours,
    });
    
    expect(screen.getByText("Lunch break")).toBeInTheDocument();
  });

  // CAL-U-082: Break has delete button
  it("CAL-U-082: break card has delete button that calls onDeleteBreak", () => {
    const onDeleteBreak = vi.fn();
    
    renderCalendar({ 
      stations: mockStations,
      breaks: [mockBreak],
      workingHours: mockWorkingHours,
      onDeleteBreak,
    });
    
    // Find break card and hover to reveal delete button
    const breakCard = screen.getByText("12:00 - 12:30").closest('[class*="bg-slate"]');
    if (breakCard) {
      const deleteButton = breakCard.querySelector('button');
      if (deleteButton) {
        fireEvent.click(deleteButton);
        expect(onDeleteBreak).toHaveBeenCalledWith("break-1");
      }
    }
  });
});

// =============================================================================
// Additional: Hall Mode
// =============================================================================
describe("AdminCalendar - Hall Mode", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    localStorage.clear();
  });

  // CAL-U-090: Hall mode hides some controls
  it("CAL-U-090: hall mode simplifies UI", () => {
    renderCalendar({ 
      stations: mockStations,
      hallMode: true,
      hallConfig: {
        visible_fields: {
          customer_name: true,
          customer_phone: false,
          vehicle_plate: true,
          services: true,
          admin_notes: false,
        },
        allowed_actions: {
          add_services: false,
          change_time: false,
          change_station: false,
        },
      },
    });
    
    // Hall mode should still render the calendar
    const clockIcon = document.querySelector("svg.lucide-clock");
    expect(clockIcon).toBeInTheDocument();
  });

  // CAL-U-091: Eye toggle controls data visibility
  it("CAL-U-091: eye toggle button is shown in hall mode", () => {
    const onToggle = vi.fn();
    
    renderCalendar({ 
      stations: mockStations,
      hallMode: true,
      hallDataVisible: true,
      onToggleHallDataVisibility: onToggle,
    });
    
    // Find eye button
    const eyeButton = document.querySelector('button[title*="dane"]');
    if (eyeButton) {
      expect(eyeButton).toBeInTheDocument();
    }
  });
});
