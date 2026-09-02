# Diagram assets

These PNG files are the static, Builder Center-compatible versions of the
dependency diagrams used in the companion article. The scenario READMEs keep
Mermaid diagrams beside the code so their edges remain reviewable as text.

Regenerate the images from the repository root with Python 3 and Pillow:

```bash
python3 docs/diagrams/generate_diagrams.py
```

The diagrams use boxes and explicit labels instead of AWS service icons. This
keeps the important distinction visible: a CDK construct can synthesize several
CloudFormation resources, and dependency direction follows those generated
resources rather than the visual runtime request path.

| File | Purpose |
|---|---|
| `cdk-to-cloudformation-flow.png` | CDK app lifecycle and dependency sources |
| `s3-lambda-cycle-and-solution.png` | Same-template S3/Lambda cycle and deferred configuration |
| `security-group-cycle-and-solutions.png` | Cross-stack cycle and two rule-ownership solutions |
| `cross-stack-reference-migration.png` | `STRONG → BOTH → WEAK → remove` deployment sequence |
