# Cosys-AirSim High-Fidelity Unreal Engine Mode (Optional)

ASTRA VEER is designed from the ground up to be **usable at the forward unit level on standard laptops without specialized GPU hardware**. The default `NativeSimSource` fulfills 100% of the training, scoring, AAR, and AI requirements.

For specialized flight simulation centers and research laboratories equipped with high-end Unreal Engine workstations, ASTRA VEER includes an optional **Cosys-AirSim Bridge** (`AirSimBridgeSource`).

---

## 1. Prerequisites (For Lab High-Fidelity Mode Only)
1. **Unreal Engine 5.3+** with a compiled environment.
2. **Cosys-AirSim Plugin**: [https://github.com/cosys-lab/cosys-airsim](https://github.com/cosys-lab/cosys-airsim)
3. Python client package:
   ```bash
   pip install cosysairsim
   # or
   pip install airsim
   ```

---

## 2. Launching High-Fidelity Mode
1. Start the Unreal Engine environment with Cosys-AirSim active (RPC port 41451).
2. Spawn drones or swarm agents in Unreal Engine.
3. In ASTRA VEER web application, navigate to **Scenario Setup** and select **Cosys-AirSim (UE5)** under Track Source.
4. If Unreal Engine is connected, the indicator will display a glowing green `READY` badge.
5. If offline or not installed, ASTRA VEER displays an informative badge explaining that AirSim is offline and automatically defaults to `NativeSimSource`.
