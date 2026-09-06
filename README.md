# WinWeb / XRun

WinWeb is a browser-native Windows application runtime project focused on running compatible Windows applications directly inside modern browsers, with iPhone Safari as the primary mobile target.

This repository follows a reuse-first architecture: multiple interchangeable runtime engines, browser capability probing, local PE inspection, persistent application containers, and no fake claims of compatibility.

## Status

Foundation implementation in progress. The first target is a real local `.exe` inspector and runtime router, followed by BottleShip/v86 HLE integration and a Wine compatibility fallback.
