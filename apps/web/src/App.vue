<script setup lang="ts">
import { healthResponseSchema } from "@hackspain/shared";
import { onMounted, ref } from "vue";

const status = ref("checking...");

onMounted(async () => {
  const response = await fetch("/api/health");
  const health = healthResponseSchema.parse(await response.json());
  status.value = `agent ready (${health.environment})`;
});
</script>

<template>
  <main>
    <h1>HackSpain</h1>
    <p>{{ status }}</p>
  </main>
</template>
