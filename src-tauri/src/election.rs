use crate::types::Peer;

pub struct ElectionEngine {
    pub current_epoch: u64,
    pub current_leader_id: String,
    pub quorum_size: usize,
}

impl ElectionEngine {
    pub fn new(initial_leader_id: String) -> Self {
        Self {
            current_epoch: 1,
            current_leader_id: initial_leader_id,
            quorum_size: 1,
        }
    }

    /// Calculate quorum requirement: floor(N / 2) + 1
    pub fn calculate_quorum(total_peers: usize) -> usize {
        (total_peers / 2) + 1
    }

    /// Checks if a new leader should be elected when the current leader is suspect/offline
    pub fn elect_successor(&mut self, active_peers: &[Peer]) -> Option<(String, u64)> {
        let total_nodes = active_peers.len() + 1; // including self
        let required_quorum = Self::calculate_quorum(total_nodes);

        if active_peers.len() + 1 < required_quorum {
            // Cannot reach quorum; prevent split-brain leadership
            return None;
        }

        // Bully / Priority based candidate election:
        // Highest priority node or lowest device ID as deterministic tie-breaker
        let mut candidates: Vec<&Peer> = active_peers
            .iter()
            .filter(|p| p.status != crate::types::PeerStatus::Offline)
            .collect();

        candidates.sort_by(|a, b| {
            b.priority
                .cmp(&a.priority)
                .then_with(|| a.id.cmp(&b.id))
        });

        if let Some(best_peer) = candidates.first() {
            self.current_epoch += 1;
            self.current_leader_id = best_peer.id.clone();
            Some((self.current_leader_id.clone(), self.current_epoch))
        } else {
            None
        }
    }
}
