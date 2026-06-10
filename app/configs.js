// generiert von tools/build_configs.py — nicht von Hand editieren
window.LAC_CONFIGS = {
 "machine_name": "Bambu Lab A2L",
 "material_name": "Generic 80g Printer Paper",
 "material_id": "B-YE-F-A-W0_temp",
 "material_thickness": 0.1,
 "process_name": "Generic 80g Printer Paper Process @BBL A2L",
 "files": {
  "Bambu Lab A2L.config": {
   "_4axis_dir": "1x0",
   "_4axis_height": 170,
   "_4axis_max_length": 228,
   "_4axis_radius": 50,
   "_4axis_split_tolerance": 0.1,
   "_4axis_start": "113x135",
   "ac_end_gcode": "; active cut end gcode\n",
   "ac_start_gcode": "; active cut start gcode\n",
   "bed_area": [
    "0x0",
    "330x0",
    "330x320",
    "0x320"
   ],
   "bezier_for_4_axis": true,
   "bezier_travel": false,
   "build_plate_area": [
    "-2.7x-19.3",
    "332.3x-19.3",
    "332.3x327.2",
    "-2.7x327.2"
   ],
   "classVersion": 3,
   "current_area_height": 0,
   "current_area_offset_x": 0,
   "current_area_offset_y": 0,
   "current_area_width": 0,
   "cutting_high_precision": false,
   "draw_end_gcode": ";=== A2L brush end_gcode ===\n;=== 2026/03/18 ===\n\nG91\nG380 S2 Z100 F1200\nG90\nG0 X-48.5 Y200 F6000\nM480 S0\nM481 S0\n\n",
   "draw_start_gcode": ";=== A2L brush start_gcode ===\n;=== 2026/04/23 ===\n;check hotend, heat bed and chamber temperture before start\nM561 P0 U50\nM561 P1 U80\nM561 P3 U40\n\n; ======== Sound before Confirm ========\n{if open_sound}\nM400\nM1006 S1\nM1006 A37 B10 L100 C37 D10 M0 E37 F10 N70\nM1006 A37 B10 L0 C37 D10 M0 E37 F10 N0\nM1006 A41 B10 L100 C41 D10 M0 E41 F10 N90\nM1006 W\nM400\n{endif}\n\nM1011 S[blade_idx]\nM1014 S[blade_idx]\n\n; ========= Sound after Confirm ========\nM400\nM1006 S1\nM1006 A53 B9 L30 C53 D9 M30 E53 F9 N30 \nM1006 A56 B9 L30 C56 D9 M30 E56 F9 N30 \nM1006 A61 B9 L30 C61 D9 M30 E61 F9 N30 \nM1006 A53 B9 L30 C53 D9 M30 E53 F9 N30 \nM1006 A56 B9 L30 C56 D9 M30 E56 F9 N30 \nM1006 A61 B18 L30 C61 D18 M30 E61 F18 N30 \nM1006 W\n\n;delay to handle injected gcode\nM400 S1\n\n; \nM480 S1\nG55\nT1500 O0\nG28 X A\nG90\nG0 X160 Y160 Z100 F4000\nG0 X5 Y20 F2000\nG384 S3 M3\nT1500 O0\nG0 Z30 F2000\nG388.1 Z-2\nG0 Z30 F4000\n\n\n\n\n",
   "drawing_cali_plate_area": [
    "-11x25",
    "-6x25",
    "-6x35",
    "-11x35"
   ],
   "drawing_mat_cali_zero": false,
   "drawing_travel_speed": 100,
   "drawing_travel_z": 3,
   "electric_current": 0.4,
   "fire_power_threshold": 36,
   "fire_speed_threshold": 10,
   "from": "project",
   "global_end_gcode": ";=== A2L global end ===\n;=== 2026/04/07 ===\n\n;======== Sound at End =========\nM400\nM1006 S1\nM1006 A53 B10 L30 C53 D10 M30 E53 F10 N30 \nM1006 A57 B10 L30 C57 D10 M30 E57 F10 N30 \nM1006 A0 B15 L0 C0 D15 M0 E0 F15 N0 \nM1006 A53 B10 L30 C53 D10 M30 E53 F10 N30 \nM1006 A57 B10 L30 C57 D10 M30 E57 F10 N30 \nM1006 A0 B15 L0 C0 D15 M0 E0 F15 N0 \nM1006 A48 B10 L30 C48 D10 M30 E48 F10 N30 \nM1006 A0 B15 L0 C0 D15 M0 E0 F15 N0 \nM1006 A60 B10 L30 C60 D10 M30 E60 F10 N30 \nM1006 W\nM400\n\n",
   "global_start_gcode": ";=== A2L global start ===\n;=== 2025/11/28===\n\n;ask for tool type\nM483\n\n;Print & Cut\n{if has_print_then_process}\nM482 S1\nM482 S0\n{endif}\n\n",
   "instantiation": true,
   "is_power_reduction_from_z": true,
   "is_support_arc": true,
   "is_support_bezier": true,
   "is_support_z": true,
   "kc_end_gcode": ";=== A2L cutting end_gcode ===\n;=== 2026/03/18 ===\n\nG91\nG380 S2 Z250 F1200\nG90\nG0 X-48.5 Y200 F6000\nM480 S0\nM481 S0",
   "kc_knife_types": [
    "Fine pointed",
    "Perforating",
    "Pen"
   ],
   "kc_start_gcode": ";=== A2L passive cutting start_gcode ===\n;=== 2026/04/23 ===\n;check hotend, heat bed and chamber temperture before start\nM561 P0 U50\nM561 P1 U80\nM561 P3 U45\n\n; ======== Sound before Confirm ========\n{if open_sound}\nM400\nM1006 S1\nM1006 A37 B10 L100 C37 D10 M0 E37 F10 N70\nM1006 A37 B10 L0 C37 D10 M0 E37 F10 N0\nM1006 A41 B10 L100 C41 D10 M0 E41 F10 N90\nM1006 W\nM400\n{endif}\n\nM1011 S[blade_idx]\nM1014 S[blade_idx]\n\n; ========= Sound after Confirm ========\nM400\nM1006 S1\nM1006 A53 B9 L30 C53 D9 M30 E53 F9 N30 \nM1006 A56 B9 L30 C56 D9 M30 E56 F9 N30 \nM1006 A61 B9 L30 C61 D9 M30 E61 F9 N30 \nM1006 A53 B9 L30 C53 D9 M30 E53 F9 N30 \nM1006 A56 B9 L30 C56 D9 M30 E56 F9 N30 \nM1006 A61 B18 L30 C61 D18 M30 E61 F18 N30 \nM1006 W\n\n;delay to handle injected gcode\nM400 S1\n\nG90\nG380 S2 Z20 F3000\nG28 X A\nG0 X175 Y160 F2000\n;pad detect\nT1300 O0\nG388\n\nM480 S1\nG55\nG0 X160 Y160 Z60 F4000",
   "kc_working_area": [
    "14.8x5.5",
    "314.8x5.5",
    "314.8x305.5",
    "14.8x305.5"
   ],
   "laser_end_gcode": "; laser end gcode\n",
   "laser_max_z_area": 150,
   "laser_module_mesh": [
    "15x15x20",
    "-15x15x20",
    "15x-30x20",
    "-15x-30x20",
    "30x20x37.5",
    "-30x20x37.5",
    "30x-40x37.5",
    "-30x-40x37.5",
    "43x0x37.5"
   ],
   "laser_power": 0,
   "laser_spot_height": 0.1,
   "laser_spot_width": 0.1,
   "laser_start_gcode": "; laser_start gcode\n",
   "laser_working_area": [
    "0x25",
    "351x25",
    "351x296",
    "0x296"
   ],
   "machine_max_acceleration_u": 100,
   "machine_max_acceleration_x": 6000,
   "machine_max_acceleration_y": 6000,
   "machine_max_acceleration_z": 500,
   "machine_max_jerk_u": 0.5,
   "machine_max_jerk_x": 9,
   "machine_max_jerk_y": 9,
   "machine_max_jerk_z": 3,
   "machine_max_speed_u": 8,
   "machine_max_speed_x": 1000,
   "machine_max_speed_y": 1000,
   "machine_max_speed_z": 25,
   "machine_speed_comfortable": 60,
   "machine_speed_travel": 300,
   "max_tool_count": 5,
   "measure_height_area": [
    "56x40",
    "330x40",
    "330x288.3",
    "56x288.3"
   ],
   "min_direction_change": false,
   "name": "Bambu Lab A2L",
   "optimize_tip_offset": true,
   "origin_position": "LEFT_BOTTOM",
   "pen_offset": [
    0,
    0,
    0,
    45
   ],
   "plate_turning_area": [
    "-16x10",
    "-6x10",
    "-6x25",
    "-16x25"
   ],
   "pressure_mapping": [],
   "printer_model": "Bambu Lab A2L",
   "printer_variant": "",
   "ptc_offset": [
    0,
    0
   ],
   "s_value": 1000,
   "surface_z_delayed": 0.5,
   "travel_pressure": -5,
   "travel_z": 3,
   "type": "machine",
   "unsupported_image_mode": [
    "GRID_GRAYSCALE"
   ],
   "us_end_gcode": "; ultra sound cut end gcode\n",
   "us_start_gcode": "; ultra sound cut start gcode\n",
   "use_sound_first_blade": false,
   "using_R_for_G2G3": false,
   "using_Z_for_pressure": true,
   "vendor": "BBL",
   "working_z_base": 0
  },
  "Generic 80g Printer Paper.config": {
   "classVersion": 3,
   "from": "project",
   "instantiation": true,
   "material_id": "B-YE-F-A-W0_temp",
   "name": "Generic 80g Printer Paper",
   "type": "filament",
   "category": "Paper",
   "description": "The material is suitable for Bambu Lab H2D-10W,Bambu Lab H2D-40W, you can choose different Processing Types.",
   "material_cutting_mat": "LIGHT_GRIP",
   "material_flammability": "M3",
   "material_process_feature": 0,
   "material_support_comp": "SUPPORT_COMP_BLADE",
   "material_thickness": 0.1,
   "material_vendor": "Generic",
   "version": "00.00.00.01"
  },
  "Generic 80g Printer Paper Process @BBL A2L.config": {
   "from": "project",
   "instantiation": true,
   "name": "Generic 80g Printer Paper Process @BBL A2L",
   "type": "process",
   "vendor": "BBL",
   "classVersion": 3,
   "compatible_materials": [
    "Generic 80g Printer Paper"
   ],
   "process_types": [
    "KCBasicCut",
    "KCPenDraw",
    "KCPrintThenCut",
    "KCPenDrawFill"
   ],
   "compatible_printers": [
    "Bambu Lab A2L"
   ],
   "KCBasicCut": {
    "blade_type": "FINE_POINT",
    "number_of_passes": 1,
    "pressure": 75,
    "speed": 50,
    "turning_pressure": 57,
    "z_compensation_x": 0,
    "z_compensation_y": -0.04
   },
   "KCPenDraw": {
    "number_of_passes": 1,
    "pressure": 45,
    "speed": 50
   },
   "KCPenDrawFill": {
    "number_of_passes": 1,
    "pressure": 45,
    "speed": 160
   },
   "KCPrintThenCut": {
    "number_of_passes": 1,
    "pressure": 62,
    "speed": 50,
    "turning_pressure": 57,
    "z_compensation_x": 0,
    "z_compensation_y": -0.1
   },
   "number_of_passes": 1,
   "speed": 50
  }
 }
};
