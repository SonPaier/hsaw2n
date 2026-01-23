import "@testing-library/jest-dom";
import { beforeEach } from "vitest";
import { setViewport } from "./utils/viewport";

// Reset viewport to desktop before each test for isolation
beforeEach(() => {
  setViewport("desktop");
});

// Mock ResizeObserver for components using it
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
