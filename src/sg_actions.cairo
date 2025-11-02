use dojo::event::EventStorage;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;

use crate::models::Direction;
use starknet::{ContractAddress, get_caller_address, get_block_number};

use crate::sg_models::{Player, Run, Ghost, GhostKind, popcount_u8};

#[starknet::interface]
pub trait ISpirit<T> {
    fn start_run(ref self: T);
    fn move(ref self: T, direction: Direction);

    fn use_thermo(ref self: T);
    fn use_uv(ref self: T);
    fn use_emf(ref self: T);
    fn use_spirit(ref self: T);
    fn use_writing(ref self: T);
    fn use_prop(ref self: T);
    fn guess(ref self: T, kind: GhostKind);
    fn proximity(self: @T) -> u32;
}

#[dojo::contract]
pub mod sg_actions {
    use super::*;

    // ----------------- config -----------------
    const GRID_W: u32 = 7_u32;
    const GRID_H: u32 = 7_u32;

    // spawn player at (3,6) per your layout
    const START_PX: u32 = 3_u32;
    const START_PY: u32 = 6_u32;

    const START_CREDITS: u32 = 100_u32;
    const MOVE_COST: u32 = 1_u32;
    const TOOL_COST: u32 = 1_u32;

    // evidence bits in Run.evidence (must match client EVBIT)
    const EV_THERMO: u8 = 0_u8;
    const EV_UV:     u8 = 1_u8;
    const EV_EMF:    u8 = 2_u8;
    const EV_SPIRIT: u8 = 3_u8;
    const EV_WRIT:   u8 = 4_u8;
    const EV_PROP:   u8 = 5_u8;

    // ------------- WALKABLE TILE MASK (7x7 -> 49 bits) -------------
    // Index = py*GRID_W + px  (row-major from top-left)
    // Default: all walkable. Later: carve corridors by clearing bits.
    // (1 << 49) - 1 = 0x1ffffffffffff
    const WALKABLE_MASK: u64 = 0x1ffffffffffff_u64;

    // ----------------- events -----------------
    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct EvidenceFound {
        #[key]
        pub player: ContractAddress,
        pub ev_bit: u8,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct EvidenceNoResponse {
        #[key]
        pub player: ContractAddress,
        pub ev_bit: u8,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RunStarted {
        #[key]
        pub player: ContractAddress,
        pub ghost_kind: GhostKind,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RunFinished {
        #[key]
        pub player: ContractAddress,
        pub won: bool,
        pub guessed: GhostKind,
        pub actual: GhostKind,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct ThermoReading {
        #[key]
        pub player: ContractAddress,
        pub temp: i32,
    }

    // ----------------- helpers -----------------

    // simple LCG under a small modulus to avoid shifts/xors on integers
    fn rand_small(seed: u64, modulus: u64) -> u64 {
        if modulus == 0_u64 { return 0_u64; }
        let a_mod = (1103515245_u64) % modulus;
        let c_mod = (12345_u64) % modulus;
        let s_mod = seed % modulus;
        ((a_mod * s_mod) + c_mod) % modulus
    }

    // pick one of 6 ghost kinds
    fn random_kind() -> GhostKind {
        let bn: u64 = get_block_number();
        let idx = rand_small(bn + 17_u64, 6_u64);
        match idx {
            0_u64 => GhostKind::Wraith,
            1_u64 => GhostKind::Phantom,
            2_u64 => GhostKind::Poltergeist,
            3_u64 => GhostKind::Banshee,
            4_u64 => GhostKind::Shade,
            _     => GhostKind::Revenant,
        }
    }

    // ---- CORNER-ONLY 2x2 room placement ----
    fn random_corner_room() -> (u32, u32) {
        let bn: u64 = get_block_number();

        // corner: 0=TL, 1=TR, 2=BL, 3=BR
        let corner = (bn + 201_u64) % 4_u64;

        // pick one of the 4 possible 2×2 top-lefts inside the 3×3 (ox,oy ∈ {0,1})
        let pick = (bn + 777_u64) % 4_u64; // 0..3
        let ox: u32 = (pick % 2_u64).try_into().unwrap();
        let oy: u32 = (pick / 2_u64).try_into().unwrap();

        let base_x_corner: u32 = GRID_W - 3_u32; // 7-3=4
        let base_y_corner: u32 = GRID_H - 3_u32; // 7-3=4

        match corner {
            0_u64 => (0_u32 + ox,           0_u32 + oy          ), // TL block (0..2,0..2)
            1_u64 => (base_x_corner + ox,   0_u32 + oy          ), // TR block (4..6,0..2)
            2_u64 => (0_u32 + ox,           base_y_corner + oy  ), // BL block (0..2,4..6)
            _     => (base_x_corner + ox,   base_y_corner + oy  ), // BR block (4..6,4..6)
        }
    }

    // are we standing in the 2×2 ghost room?
    fn in_ghost_room(px: u32, py: u32, gx: u32, gy: u32) -> bool {
        let x_ok = (px == gx) || (px == gx + 1_u32);
        let y_ok = (py == gy) || (py == gy + 1_u32);
        x_ok && y_ok
    }

    // which tools this ghost can respond to
    fn ghost_supports(kind: GhostKind, ev_bit: u8) -> bool {
        match kind {
            GhostKind::Wraith => {
                (ev_bit == EV_UV) || (ev_bit == EV_EMF) || (ev_bit == EV_SPIRIT)
            },
            GhostKind::Phantom => {
                (ev_bit == EV_UV) || (ev_bit == EV_SPIRIT) || (ev_bit == EV_WRIT)
            },
            GhostKind::Poltergeist => {
                (ev_bit == EV_EMF) || (ev_bit == EV_WRIT) || (ev_bit == EV_PROP)
            },
            GhostKind::Banshee => {
                (ev_bit == EV_UV) || (ev_bit == EV_WRIT) || (ev_bit == EV_PROP)
            },
            GhostKind::Shade => {
                (ev_bit == EV_THERMO) || (ev_bit == EV_WRIT) || (ev_bit == EV_EMF)
            },
            GhostKind::Revenant => {
                (ev_bit == EV_THERMO) || (ev_bit == EV_UV) || (ev_bit == EV_SPIRIT)
            },
        }
    }

    // (no << on u8) – build mask via lookup
    fn bit_mask(bit: u8) -> u8 {
        match bit {
            0_u8 => 1_u8,
            1_u8 => 2_u8,
            2_u8 => 4_u8,
            3_u8 => 8_u8,
            4_u8 => 16_u8,
            5_u8 => 32_u8,
            6_u8 => 64_u8,
            _    => 128_u8,
        }
    }
    fn set_bit(mask: u8, bit: u8) -> u8 { mask | bit_mask(bit) }

    fn pow2_u64(n: u32) -> u64 {
        let mut res: u64 = 1_u64;
        let mut i: u32 = 0_u32;
        while i < n {
            res = res * 2_u64;
            i += 1_u32;
        }
        res
    }
    
    // walkable helper
    fn is_walkable(px: u32, py: u32) -> bool {
        if px >= GRID_W { return false; }
        if py >= GRID_H { return false; }
        let idx_u64: u64 = (py.into() * GRID_W.into()) + px.into(); // 0..48
        let bit: u64 = pow2_u64(idx_u64.try_into().unwrap());
        (WALKABLE_MASK & bit) != 0_u64
    }

    // shared tool logic: spend credit, check room + support, set bit or emit no-response
    fn apply_tool(mut world: WorldStorage, player: ContractAddress, ev_bit: u8, also_emit_temp: bool) {
        let mut run: Run = world.read_model(player);
        if !run.active { return; }
        if run.credits == 0_u32 { return; }

        let ghost: Ghost = world.read_model(player);

        // pay tool cost
        run.credits -= TOOL_COST;

        let in_room = in_ghost_room(run.px, run.py, ghost.gx, ghost.gy);
        let supported = ghost_supports(ghost.kind, ev_bit);

        if in_room && supported {
            run.evidence = set_bit(run.evidence, ev_bit);
            world.write_model(@run);
            world.emit_event(@EvidenceFound { player, ev_bit });
            if also_emit_temp {
                // when found via thermo, send a "freezing" style reading
                world.emit_event(@ThermoReading { player, temp: -5 });
            }
        } else {
            world.write_model(@run);
            world.emit_event(@EvidenceNoResponse { player, ev_bit });
            if also_emit_temp {
                // a neutral-ish ambient reading
                world.emit_event(@ThermoReading { player, temp: 18 });
            }
        }
    }

    fn min_u32(a: u32, b: u32) -> u32 { if a < b { a } else { b } }
    fn abs_diff(a: u32, b: u32) -> u32 {
        if a >= b { a - b } else { b - a }
    }
    // Manhattan distance to nearest tile of the 2x2 ghost room
    fn distance_to_room(px: u32, py: u32, gx: u32, gy: u32) -> u32 {
        let dx0 = abs_diff(px, gx);
        let dx1 = abs_diff(px, gx + 1_u32);
        let dy0 = abs_diff(py, gy);
        let dy1 = abs_diff(py, gy + 1_u32);
        let dx = min_u32(dx0, dx1);
        let dy = min_u32(dy0, dy1);
        dx + dy
    }

    // ----------------- externs -----------------
    #[abi(embed_v0)]
    impl SpiritImpl of ISpirit<ContractState> {
        fn start_run(ref self: ContractState) {
            let mut world = self.world_default();
            let player = get_caller_address();

            let (gx, gy) = random_corner_room();
            let kind = random_kind();

            let run = Run {
                player,
                seed: get_block_number(),
                grid_w: GRID_W, grid_h: GRID_H,
                px: START_PX, py: START_PY,
                credits: START_CREDITS,
                step: 0_u32,
                evidence: 0_u8,
                active: true,
            };
            let ghost = Ghost { player, kind, gx, gy };

            world.write_model(@run);
            world.write_model(@ghost);

            // ensure Player row exists
            let mut p: Player = world.read_model(player);
            p.player = player;
            world.write_model(@p);

            world.emit_event(@RunStarted { player, ghost_kind: kind });
        }

        fn move(ref self: ContractState, direction: Direction) {
            let mut world = self.world_default();
            let player = get_caller_address();
            let mut run: Run = world.read_model(player);
            if !run.active { return; }
            if run.credits == 0_u32 { return; }

            let mut nx: u32 = run.px;
            let mut ny: u32 = run.py;

            match direction {
                Direction::Left  => { if run.px > 0_u32 { nx = run.px - 1_u32; } },
                Direction::Right => { if run.px + 1_u32 < run.grid_w { nx = run.px + 1_u32; } },
                Direction::Up    => { if run.py > 0_u32 { ny = run.py - 1_u32; } },
                Direction::Down  => { if run.py + 1_u32 < run.grid_h { ny = run.py + 1_u32; } },
            }

            let moved = (nx != run.px) || (ny != run.py);
            if moved && is_walkable(nx, ny) {
                run.px = nx;
                run.py = ny;
                run.credits -= MOVE_COST;
                run.step += 1_u32;
            }
            world.write_model(@run);
        }

        // tools
        fn use_thermo(ref self: ContractState) {
            let mut world = self.world_default();
            let player = get_caller_address();
            apply_tool(world, player, EV_THERMO, true);
        }
        fn use_uv(ref self: ContractState) {
            let mut world = self.world_default();
            let player = get_caller_address();
            apply_tool(world, player, EV_UV, false);
        }
        fn use_emf(ref self: ContractState) {
            let mut world = self.world_default();
            let player = get_caller_address();
            apply_tool(world, player, EV_EMF, false);
        }
        fn use_spirit(ref self: ContractState) {
            let mut world = self.world_default();
            let player = get_caller_address();
            apply_tool(world, player, EV_SPIRIT, false);
        }
        fn use_writing(ref self: ContractState) {
            let mut world = self.world_default();
            let player = get_caller_address();
            apply_tool(world, player, EV_WRIT, false);
        }
        fn use_prop(ref self: ContractState) {
            let mut world = self.world_default();
            let player = get_caller_address();
            apply_tool(world, player, EV_PROP, false);
        }

        fn guess(ref self: ContractState, kind: GhostKind) {
            let mut world = self.world_default();
            let player = get_caller_address();

            let mut run: Run = world.read_model(player);
            if !run.active { return; }

            let ghost: Ghost = world.read_model(player);

            run.active = false;
            world.write_model(@run);

            // score = credits + 10 per evidence + 50 if correct
            let ev_cnt_u8: u8 = popcount_u8(run.evidence);
            let ev_cnt: u32 = ev_cnt_u8.try_into().unwrap();

            let mut score: u32 = run.credits + ev_cnt * 10_u32;
            let won = ghost.kind == kind;
            if won { score += 50_u32; }

            let mut p: Player = world.read_model(player);
            if score > p.best_score { p.best_score = score; }
            p.total_runs += 1_u32;
            world.write_model(@p);

            world.emit_event(@RunFinished { player, won, guessed: kind, actual: ghost.kind });
        }

        fn proximity(self: @ContractState) -> u32 {
            let world = self.world_default();
            let player = get_caller_address();
            let run: Run = world.read_model(player);
            if !run.active { return 0_u32; }
            let ghost: Ghost = world.read_model(player);
            distance_to_room(run.px, run.py, ghost.gx, ghost.gy)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"ghostgrid")
        }
    }
}