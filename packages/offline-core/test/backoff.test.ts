import { test } from "node:test";
import assert from "node:assert/strict";
import { backoffMs } from "../src/backoff.js";

test("cresce exponencialmente com jitter zero", () => {
  const semJitter = () => 0;
  assert.equal(backoffMs(0, { baseMs: 1000, rand: semJitter }), 500);
  assert.equal(backoffMs(1, { baseMs: 1000, rand: semJitter }), 1000);
  assert.equal(backoffMs(2, { baseMs: 1000, rand: semJitter }), 2000);
  assert.equal(backoffMs(3, { baseMs: 1000, rand: semJitter }), 4000);
});

test("jitter máximo se aproxima do valor exponencial cheio", () => {
  const quaseUm = () => 0.9999;
  assert.equal(backoffMs(2, { baseMs: 1000, rand: quaseUm }), 4000);
});

test("respeita o teto configurável", () => {
  const semJitter = () => 0;
  assert.equal(backoffMs(20, { baseMs: 1000, maxMs: 60_000, rand: semJitter }), 30_000);
  const quaseUm = () => 0.9999;
  assert.ok(backoffMs(20, { baseMs: 1000, maxMs: 60_000, rand: quaseUm }) <= 60_000);
});

test("tentativas negativas são tratadas como zero", () => {
  assert.equal(backoffMs(-3, { baseMs: 1000, rand: () => 0 }), 500);
});
