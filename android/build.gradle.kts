plugins {
    id("com.android.application") version "8.7.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    // Seit Kotlin 2.0 zwingend nötig, sobald Compose aktiv ist (buildFeatures.compose = true
    // im App-Modul) — der alte composeOptions{}-Weg reicht nicht mehr.
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
}
