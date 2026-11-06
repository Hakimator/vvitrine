# Writing content

Content is a YAML (or JSON) document per language, read by the `@vvitrine/source-yaml` plugin:

- `content/resume.<locale>.yaml` is used for that locale (e.g. `resume.en.yaml`);
- otherwise `content/resume.yaml` is used.

The format follows [JSON Resume](https://jsonresume.org/schema), so you can reuse an existing `resume.json`.
Fields specific to VVitrine live under `x-vvitrine` and do not break JSON Resume tools.

## Who validates what

The core validates `basics` (your identity). **Every other key is validated by the plugin that owns it**: `work` by the
work section, `projects` by the projects section, `talks` by your own talks plugin, and so on. Unused keys produce a
warning, never a silent error.

## Keys provided by the built-in sections

| Key         | Section       | Main fields                                                                                                                                              |
| ----------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basics`    | core / `hero` | `name` (required), `label`, `email`, `summary`, `location { city, region, countryCode }`, `profiles [{ network, url }]`, `x-vvitrine.availability`       |
| `work`      | `work`        | `name`, `position`, `startDate`, `endDate` (omit = ongoing), `location`, `url`, `summary`, `highlights`                                                  |
| `education` | `education`   | `institution`, `studyType`, `area`, `startDate`, `endDate`, `courses`                                                                                    |
| `skills`    | `skills`      | `name`, `level`, `keywords`                                                                                                                              |
| `languages` | `languages`   | `language`, `fluency`                                                                                                                                    |
| `projects`  | `projects`    | `name`, `description`, `highlights`, `keywords`, `roles`, `startDate`, `endDate`, `url`, `x-vvitrine { slug, repository, featured, image { src, alt } }` |

Dates are `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. They are displayed in the reader's language (`juin 2025`, `Jun 2025`).

Each project gets its own page at `/projects/<slug>/` (the slug comes from the name unless you set
`x-vvitrine.slug`). Images need an `alt` text: the build refuses an image without one (accessibility).

## Privacy

Only publish what you want public. No field is required except `basics.name`. There is no phone field in the built-in
sections on purpose.
