#!/usr/bin/env python3
"""
Laboratorio Yahtzee — Método de Montecarlo (Python)

Simula el juego Yahtzee clásico con 2 jugadores usando la generación
de números aleatorios con distribución uniforme discreta:
    P(X = k) = 1/6  para  k ∈ {1, 2, 3, 4, 5, 6}
"""

from __future__ import annotations

from dataclasses import dataclass, field
import argparse
import math
import random
from typing import Dict, List, Optional, Tuple


NUM_PLAYERS = 2
NUM_DICE = 5
MAX_ROLLS = 3
NUM_TURNS = 13

UPPER_CATEGORIES = ["ones", "twos", "threes", "fours", "fives", "sixes"]
LOWER_CATEGORIES = [
    "threeOfKind",
    "fourOfKind",
    "fullHouse",
    "smallStraight",
    "largeStraight",
    "yahtzee",
    "chance",
]
ALL_CATEGORIES = UPPER_CATEGORIES + LOWER_CATEGORIES

UPPER_BONUS_THRESHOLD = 63
UPPER_BONUS_VALUE = 35

CATEGORY_LABELS = {
    "ones": "Unos",
    "twos": "Dos",
    "threes": "Tres",
    "fours": "Cuatros",
    "fives": "Cincos",
    "sixes": "Seises",
    "threeOfKind": "Trío",
    "fourOfKind": "Póker",
    "fullHouse": "Full House",
    "smallStraight": "Escalera Menor",
    "largeStraight": "Escalera Mayor",
    "yahtzee": "Yahtzee",
    "chance": "Chance",
}


def roll_single_die() -> int:
    """Genera un entero uniforme en [1, 6]."""
    return math.floor(random.random() * 6) + 1


def has_sequence(sorted_unique: List[int], n: int) -> bool:
    if len(sorted_unique) < n:
        return False
    consecutive = 1
    for i in range(1, len(sorted_unique)):
        if sorted_unique[i] == sorted_unique[i - 1] + 1:
            consecutive += 1
            if consecutive >= n:
                return True
        elif sorted_unique[i] != sorted_unique[i - 1]:
            consecutive = 1
    return consecutive >= n


def calculate_score(category: str, dice_values: List[int]) -> int:
    counts: Dict[int, int] = {}
    total = sum(dice_values)
    for value in dice_values:
        counts[value] = counts.get(value, 0) + 1

    frequencies = list(counts.values())

    if category in UPPER_CATEGORIES:
        num = UPPER_CATEGORIES.index(category) + 1
        return counts.get(num, 0) * num

    if category == "threeOfKind":
        return total if any(f >= 3 for f in frequencies) else 0
    if category == "fourOfKind":
        return total if any(f >= 4 for f in frequencies) else 0
    if category == "fullHouse":
        return 25 if (3 in frequencies and 2 in frequencies) else 0
    if category == "smallStraight":
        unique = sorted(set(dice_values))
        return 30 if has_sequence(unique, 4) else 0
    if category == "largeStraight":
        unique = sorted(set(dice_values))
        return 40 if has_sequence(unique, 5) else 0
    if category == "yahtzee":
        return 50 if 5 in frequencies else 0
    if category == "chance":
        return total

    return 0


@dataclass
class Stats:
    total_rolls: int = 0
    turns_completed: int = 0
    yahtzee_count: int = 0
    roll_history: List[int] = field(default_factory=list)


@dataclass
class PlayerState:
    scores: Dict[str, Optional[int]] = field(
        default_factory=lambda: {cat: None for cat in ALL_CATEGORIES}
    )
    bonus: Optional[int] = None

    def upper_sum(self) -> int:
        return sum(self.scores.get(cat, 0) or 0 for cat in UPPER_CATEGORIES)

    def total_score(self) -> int:
        total = sum(self.scores.get(cat, 0) or 0 for cat in ALL_CATEGORIES)
        if self.bonus == UPPER_BONUS_VALUE:
            total += UPPER_BONUS_VALUE
        return total

    def upper_complete(self) -> bool:
        return all(self.scores[cat] is not None for cat in UPPER_CATEGORIES)


@dataclass
class GameState:
    current_player: int = 0
    rolls_left: int = MAX_ROLLS
    dice: List[int] = field(default_factory=lambda: [0] * NUM_DICE)
    locked: List[bool] = field(default_factory=lambda: [False] * NUM_DICE)
    players: List[PlayerState] = field(default_factory=lambda: [PlayerState(), PlayerState()])
    stats: Stats = field(default_factory=Stats)

    def reset_turn(self) -> None:
        self.rolls_left = MAX_ROLLS
        self.dice = [0] * NUM_DICE
        self.locked = [False] * NUM_DICE


class YahtzeeGame:
    def __init__(self, auto: bool = False) -> None:
        self.state = GameState()
        self.auto = auto

    def roll_dice(self) -> None:
        if self.state.rolls_left <= 0:
            return
        for i in range(NUM_DICE):
            if not self.state.locked[i]:
                self.state.dice[i] = roll_single_die()
                self.state.stats.total_rolls += 1
                self.state.stats.roll_history.append(self.state.dice[i])
        self.state.rolls_left -= 1

    def preview_scores(self, player_index: int) -> List[Tuple[str, int]]:
        dice = self.state.dice
        previews = []
        for category in ALL_CATEGORIES:
            if self.state.players[player_index].scores[category] is None:
                previews.append((category, calculate_score(category, dice)))
        return previews

    def apply_score(self, player_index: int, category: str) -> None:
        score = calculate_score(category, self.state.dice)
        self.state.players[player_index].scores[category] = score
        if category == "yahtzee" and score == 50:
            self.state.stats.yahtzee_count += 1
        self.update_upper_bonus(player_index)
        self.state.stats.turns_completed += 1

    def update_upper_bonus(self, player_index: int) -> None:
        player = self.state.players[player_index]
        if player.upper_complete():
            player.bonus = (
                UPPER_BONUS_VALUE if player.upper_sum() >= UPPER_BONUS_THRESHOLD else 0
            )

    def game_over(self) -> bool:
        return all(
            all(player.scores[cat] is not None for cat in ALL_CATEGORIES)
            for player in self.state.players
        )

    def next_player(self) -> None:
        self.state.current_player = (self.state.current_player + 1) % NUM_PLAYERS
        self.state.reset_turn()

    def play(self) -> None:
        self.print_intro()
        while not self.game_over():
            self.play_turn(self.state.current_player)
            self.next_player()
        self.print_winner()

    def play_turn(self, player_index: int) -> None:
        player_turns = sum(
            1 for cat in ALL_CATEGORIES if self.state.players[player_index].scores[cat] is not None
        )
        turn_num = min(player_turns + 1, NUM_TURNS)
        print(f"\n🎲 Turno de: Jugador {player_index + 1}  (Turno {turn_num}/{NUM_TURNS})")

        while self.state.rolls_left > 0:
            self.roll_dice()
            self.print_dice()
            if self.state.rolls_left == 0:
                break

            if self.auto:
                self.auto_lock_strategy()
                if self.state.rolls_left > 0:
                    continue
            else:
                if not self.prompt_locking():
                    break

        self.choose_category(player_index)

    def print_dice(self) -> None:
        lock_marks = ["🔒" if locked else " " for locked in self.state.locked]
        dice_line = " ".join(
            f"[{i + 1}:{val}{mark}]" for i, (val, mark) in enumerate(zip(self.state.dice, lock_marks))
        )
        print(f"Dados: {dice_line} | Lanzamientos restantes: {self.state.rolls_left}")

    def prompt_locking(self) -> bool:
        print("🔒 Ingresa índices (1-5) para bloquear/desbloquear, o Enter para continuar.")
        raw = input("Bloquear dados: ").strip()
        if raw:
            indices = []
            for token in raw.split():
                if token.isdigit():
                    idx = int(token)
                    if 1 <= idx <= NUM_DICE:
                        indices.append(idx - 1)
            for idx in indices:
                self.state.locked[idx] = not self.state.locked[idx]
            self.print_dice()

        answer = input("¿Desea relanzar? (s/n): ").strip().lower()
        return answer == "s"

    def auto_lock_strategy(self) -> None:
        # Estrategia simple: mantener dados iguales si hay frecuencia >= 2
        counts: Dict[int, int] = {}
        for value in self.state.dice:
            counts[value] = counts.get(value, 0) + 1
        target = max(counts, key=lambda value: counts[value])
        for i, value in enumerate(self.state.dice):
            self.state.locked[i] = counts[value] >= 2 and value == target

    def choose_category(self, player_index: int) -> None:
        previews = self.preview_scores(player_index)
        print("\n📊 Categorías disponibles:")
        for i, (category, score) in enumerate(previews, start=1):
            label = CATEGORY_LABELS.get(category, category)
            print(f"  {i:2d}. {label:<16} → {score} pts")

        if self.auto:
            best = max(previews, key=lambda item: item[1])
            chosen = best[0]
            print(f"✅ Selección automática: {CATEGORY_LABELS[chosen]} ({best[1]} pts)")
        else:
            chosen = self.prompt_category(previews)

        self.apply_score(player_index, chosen)
        self.print_player_totals(player_index)

    def prompt_category(self, previews: List[Tuple[str, int]]) -> str:
        while True:
            raw = input("Elige una categoría (número): ").strip()
            if raw.isdigit():
                idx = int(raw)
                if 1 <= idx <= len(previews):
                    return previews[idx - 1][0]
            print("⚠️ Selección inválida. Intenta nuevamente.")

    def print_player_totals(self, player_index: int) -> None:
        player = self.state.players[player_index]
        print(
            f"✅ Puntuación Jugador {player_index + 1}: "
            f"{player.total_score()} pts (Bonus: {player.bonus})"
        )

    def print_winner(self) -> None:
        totals = [player.total_score() for player in self.state.players]
        print("\n🏆 Resultado final:")
        for i, total in enumerate(totals, start=1):
            print(f"  Jugador {i}: {total} pts")

        if totals[0] > totals[1]:
            print("🎉 ¡Jugador 1 gana!")
        elif totals[1] > totals[0]:
            print("🎉 ¡Jugador 2 gana!")
        else:
            print("🤝 ¡Empate!")

        self.print_stats()

    def print_stats(self) -> None:
        avg = (
            sum(self.state.stats.roll_history) / len(self.state.stats.roll_history)
            if self.state.stats.roll_history
            else 3.5
        )
        print("\n📈 Estadísticas:")
        print(f"  Total de lanzamientos: {self.state.stats.total_rolls}")
        print(f"  Turnos completados: {self.state.stats.turns_completed}")
        print(f"  Yahtzees obtenidos: {self.state.stats.yahtzee_count}")
        print(f"  Promedio por lanzamiento: {avg:.2f}")

    @staticmethod
    def print_intro() -> None:
        print("🎲 Laboratorio Yahtzee — Método de Montecarlo (Python)")
        print("✅ Cada dado se genera con distribución uniforme discreta P(X=k) = 1/6")
        print("✅ Máximo 3 lanzamientos por turno, con bloqueo de dados")
        print("✅ 13 categorías de puntuación por jugador")
        print("-" * 60)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Simulación de Yahtzee (2 jugadores) con método de Montecarlo."
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Jugar automáticamente con una estrategia simple.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    YahtzeeGame(auto=args.auto).play()


if __name__ == "__main__":
    main()
