pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "BunnyMetronome"
include(":policy")
val sdkDir = providers.gradleProperty("sdk.dir").orNull
    ?: System.getenv("ANDROID_HOME")
    ?: System.getenv("ANDROID_SDK_ROOT")
val localProps = java.util.Properties()
val localFile = file("local.properties")
if (localFile.exists()) localFile.inputStream().use { localProps.load(it) }
val resolvedSdk = sdkDir ?: localProps.getProperty("sdk.dir")
if (!resolvedSdk.isNullOrBlank()) {
    include(":app")
}
