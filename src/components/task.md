# Task List: Real Shift Simulation

- [x] 1. Update `SimulationConfig` state in `ia-client.tsx`.
    - [x] Add `shiftType`.
    - [x] Add break configuration states (lunch, dinner, breakfast).
- [/] 2. Update `virtualTime` logic.
    - [ ] Calculate current virtual time based on shift start time and `elapsedTime`.
    - [ ] Create helper to format virtual time to HH:MM.
    - [ ] Create helper to determine if a break is currently active.
- [/] 3. Modify Simulation Loop.
    - [x] Calculate virtual time and check for active breaks.
    - [ ] Inject break logic check: Only pause packaging machines/wrappers during breaks.
    - [ ] Stop simulation automatically when shift hours are met.
- [ ] 4. Update User Interface.
    - [ ] Build the large Digital Clock component.
    - [ ] Build the Shift Configuration section (Day/Night selector, EDITABLE break times).
    - [ ] Display "ALMUERZO / PAUSA" banner (Specifying Packaging pause).
- [ ] 5. Implement Shift Report Modal.
    - [ ] Create `ShiftReportDialog` component.
    - [ ] Trigger modal at the end of the shift.
