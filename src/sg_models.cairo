use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Player {
    #[key]
    pub player: ContractAddress,
    pub best_score: u32,
    pub total_runs: u32,
    pub correct_guesses: u32,
    pub sum_steps: u64,
    pub sum_blocks: u64,
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Run {
    #[key]
    pub player: ContractAddress,
    pub seed: u64,
    pub grid_w: u32,
    pub grid_h: u32,
    pub px: u32,
    pub py: u32,
    pub credits: u32,
    pub step: u32,

    // Evidence is a BITMASK (bit0..bit5). UI can popcount if it wants a count.
    pub evidence: u8,

    pub active: bool,
}

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug, DojoStore, Default)]
pub enum GhostKind {
    #[default]
    Wraith,        // UV, EMF, Spirit
    Phantom,       // UV, Spirit, Writing
    Poltergeist,   // EMF, Writing, Prop
    Banshee,       // UV, Writing, Prop
    Shade,         // Thermo, Writing, EMF
    Revenant,      // Thermo, UV, Spirit
}

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Ghost {
    #[key]
    pub player: ContractAddress,

    pub kind: GhostKind,

    // top-left of the 2x2 ghost room (valid range ensures 2x2 fits)
    pub gx: u32,
    pub gy: u32,
}

// ---- helpers (kept public so systems can use them) ----

// Simple popcount for u8 (for scoring / displaying counts).
pub fn popcount_u8(x: u8) -> u8 {
    let mut c: u8 = 0;
    if (x & 1_u8)   != 0_u8 { c += 1_u8; }
    if (x & 2_u8)   != 0_u8 { c += 1_u8; }
    if (x & 4_u8)   != 0_u8 { c += 1_u8; }
    if (x & 8_u8)   != 0_u8 { c += 1_u8; }
    if (x & 16_u8)  != 0_u8 { c += 1_u8; }
    if (x & 32_u8)  != 0_u8 { c += 1_u8; }
    if (x & 64_u8)  != 0_u8 { c += 1_u8; }
    if (x & 128_u8) != 0_u8 { c += 1_u8; }
    c
}
