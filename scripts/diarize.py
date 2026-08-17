#!/usr/bin/env python3
"""Diarização de falantes com pyannote.audio."""

import argparse
import json
import os
import sys


def main():
    parser = argparse.ArgumentParser(description='Diarização de áudio com pyannote')
    parser.add_argument('audio', help='Caminho do arquivo WAV')
    parser.add_argument('-o', '--output', required=True, help='Arquivo JSON de saída')
    parser.add_argument('--min-speakers', type=int, default=None)
    parser.add_argument('--max-speakers', type=int, default=None)
    args = parser.parse_args()

    token = os.environ.get('HF_TOKEN')
    if not token:
        print('Erro: HF_TOKEN não definido no ambiente.', file=sys.stderr)
        sys.exit(1)

    # Compat: pyannote 3.x ainda passa use_auth_token ao huggingface_hub recente
    import huggingface_hub
    _orig_hf_download = huggingface_hub.hf_hub_download

    def _patched_hf_download(*args, **kwargs):
        if 'use_auth_token' in kwargs:
            kwargs['token'] = kwargs.pop('use_auth_token')
        return _orig_hf_download(*args, **kwargs)

    huggingface_hub.hf_hub_download = _patched_hf_download

    # Compat: PyTorch 2.6+ — pyannote checkpoints precisam weights_only=False
    import torch
    try:
        import torch.torch_version
        torch.serialization.add_safe_globals([torch.torch_version.TorchVersion])
    except Exception:
        pass

    _orig_torch_load = torch.load

    def _patched_torch_load(*load_args, **load_kwargs):
        load_kwargs['weights_only'] = False
        return _orig_torch_load(*load_args, **load_kwargs)

    torch.load = _patched_torch_load

    try:
        import lightning_fabric.utilities.cloud_io as cloud_io
        _orig_pl_load = cloud_io._load

        def _patched_pl_load(*load_args, **load_kwargs):
            load_kwargs['weights_only'] = False
            return _orig_pl_load(*load_args, **load_kwargs)

        cloud_io._load = _patched_pl_load
    except Exception:
        pass

    try:
        from pyannote.audio import Pipeline
    except ImportError:
        print(
            'Erro: pyannote não instalado. Rode: pip install -r requirements-diarize.txt',
            file=sys.stderr,
        )
        sys.exit(1)

    print('Carregando pipeline pyannote...', file=sys.stderr)
    os.environ['HF_TOKEN'] = token
    os.environ['HUGGING_FACE_HUB_TOKEN'] = token

    try:
        from huggingface_hub import login
        login(token=token, add_to_git_credential=False)
    except Exception:
        pass

    pipeline = Pipeline.from_pretrained('pyannote/speaker-diarization-3.1')
    if pipeline is None:
        print(
            'Erro: não foi possível baixar o pipeline pyannote.\n'
            '1. Aceite as licenças em:\n'
            '   https://huggingface.co/pyannote/speaker-diarization-3.1\n'
            '   https://huggingface.co/pyannote/segmentation-3.0\n'
            '   https://huggingface.co/pyannote/wespeaker-voxceleb-resnet34-LM\n'
            '2. Confirme HF_TOKEN no .env',
            file=sys.stderr,
        )
        sys.exit(1)

    if torch.cuda.is_available():
        pipeline.to(torch.device('cuda'))
        print('Usando GPU CUDA para diarização.', file=sys.stderr)
    else:
        print('Usando CPU para diarização.', file=sys.stderr)

    diarize_kwargs = {}
    if args.min_speakers is not None:
        diarize_kwargs['min_speakers'] = args.min_speakers
    if args.max_speakers is not None:
        diarize_kwargs['max_speakers'] = args.max_speakers

    print(f'Processando {args.audio}...', file=sys.stderr)
    diarization = pipeline(args.audio, **diarize_kwargs)

    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append({
            'start': round(turn.start, 3),
            'end': round(turn.end, 3),
            'speaker': speaker,
        })

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)

    speakers = sorted({s['speaker'] for s in segments})
    print(f'Diarização concluída: {len(segments)} trechos, {len(speakers)} falantes.', file=sys.stderr)


if __name__ == '__main__':
    main()
